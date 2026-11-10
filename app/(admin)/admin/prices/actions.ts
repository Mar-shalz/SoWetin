'use server';

import { revalidatePath } from 'next/cache';
import type { Msg } from '@/components/admin/action-form';
import { requireStaff } from '@/lib/admin/guard';
import { z } from 'zod';
import { checkImport, pricePointRow, type Known, type ObservationRow, type Report } from '@/lib/admin/prices';
import { t } from '@/lib/admin/t';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import type { Db } from '@/lib/db/server';
import { SCOUT_PROMPT_VERSION, scoutPages } from '@/lib/scout/run';

// A-04 (doc 04, sections 3 and 7). Admins only; the database checks the same (migration 20261109030000).
const MAX_CSV_BYTES = 500_000;
export type ImportState = { csv?: string; rows?: number; problems?: string[]; flagged?: string[]; ok?: string; error?: string };

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: C.TIMEZONE }).format(new Date());

async function known(supabase: Db): Promise<Known> {
  const [areas, ingredients, units, points] = await Promise.all([
    supabase.from('areas').select('id'),
    supabase.from('ingredients').select('id, name'),
    supabase.from('market_units').select('ingredient_id, area_id, label, canonical_qty'),
    supabase.from('price_points').select('ingredient_id, area_id, per_unit_mid'),
  ]);
  return {
    areas: new Set((areas.data ?? []).map((a) => a.id)),
    ingredients: new Map((ingredients.data ?? []).map((i) => [i.id, i.name])),
    units: new Map((units.data ?? []).map((u) => [`${u.ingredient_id}|${u.area_id}|${u.label}`, Number(u.canonical_qty)])),
    mids: new Map((points.data ?? []).map((p) => [`${p.ingredient_id}|${p.area_id}`, Number(p.per_unit_mid)])),
  };
}

function view(r: Report): Pick<ImportState, 'rows' | 'problems' | 'flagged'> {
  return {
    rows: r.rows.length,
    problems: r.problems.map((p) =>
      p.hint || (p.reason !== 'ingredient' && p.reason !== 'unit')
        ? t(`prices.problem.${p.reason}`, { line: p.line, hint: p.hint ?? '' })
        : t(p.reason === 'ingredient' ? 'prices.problem.ingredientNone' : 'prices.problem.unitNone', { line: p.line }),
    ),
    flagged: r.flagged.map((f) => t('prices.flag', { line: f.line, ingredient: f.ingredient_id, pct: f.changePct ?? 0 })),
  };
}

// Rebuilds the price points of the given ingredients from all their observations (doc 04, section 3).
// shortcut: runs on import and on the rebuild button only; the nightly job comes with the jobs work (doc 06).
async function recompute(supabase: Db, ingredientIds: string[]) {
  if (!ingredientIds.length) return 0;
  const [{ data: obs }, { data: ings }] = await Promise.all([
    supabase
      .from('price_observations')
      .select(
        'ingredient_id, area_id, price_ngn, unit_canonical_qty, unit_label, observed_on, market, source, source_id, confirmed_outlier, price_sources(name, kind, weight, bias_factor)',
      )
      .in('ingredient_id', ingredientIds),
    supabase.from('ingredients').select('id, retail_factor').in('id', ingredientIds),
  ]);
  const factor = new Map((ings ?? []).map((i) => [i.id, i.retail_factor === null ? null : Number(i.retail_factor)]));
  const groups = new Map<string, ObservationRow[]>();
  for (const o of (obs ?? []) as unknown as (ObservationRow & { ingredient_id: string; area_id: string })[])
    groups.set(`${o.ingredient_id}|${o.area_id}`, [...(groups.get(`${o.ingredient_id}|${o.area_id}`) ?? []), o]);
  const keep = [];
  for (const [key, rows] of groups) {
    const [ingredient, area] = key.split('|');
    const row = pricePointRow(ingredient, area, rows, factor.get(ingredient) ?? null, today(), C);
    if (row) keep.push(row);
    else await supabase.from('price_points').delete().eq('ingredient_id', ingredient).eq('area_id', area);
  }
  if (keep.length) {
    const { error } = await supabase.from('price_points').upsert(keep);
    if (error) throw new Error(error.message);
  }
  return keep.length;
}

export async function importPrices(_: ImportState, form: FormData): Promise<ImportState> {
  const { supabase, user, role } = await requireStaff();
  if (role !== 'admin') return { error: t('prices.adminOnly') };
  const file = form.get('file');
  const csv = file instanceof File && file.size ? await file.text() : String(form.get('csv') ?? '');
  if (!csv.trim()) return { error: t('prices.empty') };
  if (csv.length > MAX_CSV_BYTES) return { error: t('prices.tooBig') };
  const report = checkImport(csv, await known(supabase), today(), C);
  if (form.get('publish') !== '1') return { csv, ...view(report) };
  if (!report.rows.length) return { csv, ...view(report), error: t('prices.nothing') };

  const batch = crypto.randomUUID();
  const { error } = await supabase.from('price_observations').insert(
    report.rows.map((r) => ({
      ingredient_id: r.ingredient_id,
      area_id: r.area_id,
      unit_label: r.unit_label,
      unit_canonical_qty: r.unit_canonical_qty,
      price_ngn: r.price_ngn,
      observed_on: r.observed_on,
      market: r.market || null,
      source: r.source,
      import_batch_id: batch,
      notes: r.notes,
      created_by: user.id,
    })),
  );
  if (error) {
    console.error('importPrices', error.message);
    return { csv, ...view(report), error: t('errors.save') };
  }
  // shortcut: the newest weighing sets the unit's size; doc 04 wants the median of recent weighings, once there are several.
  for (const r of report.rows.filter((x) => x.weighed))
    await supabase
      .from('market_units')
      .update({ canonical_qty: r.unit_canonical_qty, is_placeholder: false })
      .eq('ingredient_id', r.ingredient_id)
      .eq('area_id', r.area_id)
      .eq('label', r.unit_label);
  const points = await recompute(supabase, [...new Set(report.rows.map((r) => r.ingredient_id))]);
  revalidatePath('/admin/prices');
  return { ok: t('prices.published', { rows: report.rows.length, points }) };
}

export async function recomputeAll(): Promise<Msg> {
  const { supabase, role } = await requireStaff();
  if (role !== 'admin') return { error: t('prices.adminOnly') };
  const { data } = await supabase.from('price_observations').select('ingredient_id');
  try {
    const points = await recompute(supabase, [...new Set((data ?? []).map((o) => o.ingredient_id as string))]);
    revalidatePath('/admin/prices');
    return { ok: t('prices.rebuilt', { points }) };
  } catch (e) {
    console.error('recomputeAll', e);
    return { error: t('errors.save') };
  }
}

// Price sources (doc 04, section 6.2): an admin adds a website only after checking its terms allow automated reading.
export async function addSource(_: Msg, form: FormData): Promise<Msg> {
  const { supabase, role } = await requireStaff();
  if (role !== 'admin') return { error: t('prices.adminOnly') };
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(80),
      domain: z
        .string()
        .trim()
        .toLowerCase()
        .transform((d) =>
          d
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .replace(/\/.*$/, ''),
        )
        .pipe(z.string().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/)),
      kind: z.enum(['press_survey', 'official_stats', 'online_store']),
      terms_checked_at: z.iso.date(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success || parsed.data.terms_checked_at > today()) return { error: t('prices.scout.addInvalid') };
  const { error } = await supabase.from('price_sources').insert({ ...parsed.data, weight: C.SCOUT_SOURCE_WEIGHTS[parsed.data.kind] });
  if (error) return { error: error.code === '23505' ? t('prices.scout.duplicate') : t('errors.save') };
  revalidatePath('/admin/prices');
  return { ok: t('prices.scout.added') };
}

export async function setSourceActive(_: Msg, form: FormData): Promise<Msg> {
  const { supabase, role } = await requireStaff();
  if (role !== 'admin') return { error: t('prices.adminOnly') };
  const id = z.uuid().safeParse(form.get('id'));
  if (!id.success) return { error: t('errors.save') };
  const { error } = await supabase
    .from('price_sources')
    .update({ active: form.get('active') === 'true' })
    .eq('id', id.data);
  if (error) return { error: t('errors.save') };
  revalidatePath('/admin/prices');
  return { ok: t('prices.scout.saved') };
}

// One scout run (doc 04, section 6.3): read the given pages, keep only verified prices, rebuild price points, and record
// what was kept, what was rejected and why, and any big moves (section 6.4).
// shortcut: run by an admin from A-04, a few pages at a time; the weekly job needs a server key and comes with jobs.
export async function runScout(_: Msg, form: FormData): Promise<Msg> {
  const { supabase, user, role } = await requireStaff();
  if (role !== 'admin') return { error: t('prices.adminOnly') };
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { error: t('prices.scout.noKey') };
  const urls = [
    ...new Set(
      String(form.get('urls') ?? '')
        .split(/\s+/)
        .filter(Boolean),
    ),
  ];
  if (!urls.length) return { error: t('prices.scout.noUrls') };
  if (urls.length > C.SCOUT_MAX_PAGES_PER_RUN) return { error: t('prices.scout.tooMany', { max: C.SCOUT_MAX_PAGES_PER_RUN }) };

  const [{ data: sources }, { data: ings }] = await Promise.all([
    supabase.from('price_sources').select('id, name, domain').eq('active', true).not('terms_checked_at', 'is', null),
    supabase.from('ingredients').select('id, name, canonical_unit, market_units(label, canonical_qty, area_id)'),
  ]);
  if (!sources?.length) return { error: t('prices.scout.noSources') };
  const ingredients = new Map(
    (ings ?? []).map((i) => [
      i.id as string,
      {
        name: i.name as string,
        info: {
          canonicalUnit: i.canonical_unit as 'g' | 'ml' | 'piece',
          units: ((i.market_units ?? []) as { label: string; canonical_qty: number; area_id: string }[])
            .filter((u) => u.area_id === C.DEFAULT_AREA)
            .map((u) => ({ label: u.label, qty: Number(u.canonical_qty) })),
        },
      },
    ]),
  );
  const { data: run, error: runError } = await supabase.from('scout_runs').insert({}).select('id').single();
  if (runError || !run) return { error: t('errors.save') };

  const result = await scoutPages(urls, sources, ingredients, { key, model: C.AI_MODEL_AUTHORING, timeoutMs: C.SCOUT_AI_TIMEOUT_MS }, today(), {
    delayMs: C.SCOUT_DELAY_MS,
    timeoutMs: C.SCOUT_FETCH_TIMEOUT_MS,
    maxBytes: C.SCOUT_PAGE_MAX_BYTES,
    userAgent: C.SCOUT_USER_AGENT,
    maxAgeDays: C.SCOUT_MAX_OBSERVATION_AGE_DAYS,
    maxPages: C.SCOUT_MAX_PAGES_PER_RUN,
  });
  if (result.calls.length)
    await supabase.from('ai_calls').insert(
      result.calls.map((c) => ({
        task: 'scout',
        model: C.AI_MODEL_AUTHORING,
        prompt_version: SCOUT_PROMPT_VERSION,
        user_id: user.id,
        input_tokens: c.input,
        output_tokens: c.output,
        latency_ms: c.latencyMs,
        stop_reason: c.stop,
        outcome: c.outcome,
      })),
    );
  const touched = [...new Set(result.kept.map((k) => k.ingredient_id))];
  const mids = async () =>
    new Map(
      ((await supabase.from('price_points').select('ingredient_id, per_unit_mid').eq('area_id', C.DEFAULT_AREA).in('ingredient_id', touched)).data ?? []).map(
        (p) => [p.ingredient_id as string, Number(p.per_unit_mid)],
      ),
    );
  const before = await mids();
  if (result.kept.length) {
    const { error } = await supabase
      .from('price_observations')
      .insert(
        result.kept.map((k) => ({ ...k, area_id: C.DEFAULT_AREA, source: 'ai_scout', scout_run_id: run.id, created_by: user.id, notes: SCOUT_PROMPT_VERSION })),
      );
    if (error) {
      console.error('runScout', error.message);
      return { error: t('errors.save') };
    }
    await recompute(supabase, touched);
  }
  const after = await mids();
  // shortcut: moves are measured against the last price point, not the last market check; the confidence drop comes later.
  const moves = touched
    .filter((id) => before.has(id) && after.has(id))
    .map((id) => ({ ingredient_id: id, pct: Math.round((Math.abs(after.get(id)! - before.get(id)!) / before.get(id)!) * 100) }))
    .filter((m) => m.pct > C.SCOUT_MOVE_ALERT_PCT);
  await supabase
    .from('scout_runs')
    .update({
      finished_at: new Date().toISOString(),
      pages_read: result.pagesRead,
      kept: result.kept.length,
      rejected: result.rejected.slice(0, 200),
      move_alerts: moves,
    })
    .eq('id', run.id);
  revalidatePath('/admin/prices');
  return { ok: t('prices.scout.done', { pages: result.pagesRead, kept: result.kept.length, rejected: result.rejected.length }) };
}
