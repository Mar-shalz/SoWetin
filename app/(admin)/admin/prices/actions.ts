'use server';

import { revalidatePath } from 'next/cache';
import type { Msg } from '@/components/admin/action-form';
import { requireStaff } from '@/lib/admin/guard';
import { checkImport, pricePointRow, type Known, type ObservationRow, type Report } from '@/lib/admin/prices';
import { t } from '@/lib/admin/t';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import type { Db } from '@/lib/db/server';

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
      .select('ingredient_id, area_id, price_ngn, unit_canonical_qty, observed_on, market, source, confirmed_outlier')
      .in('ingredient_id', ingredientIds),
    supabase.from('ingredients').select('id, retail_factor').in('id', ingredientIds),
  ]);
  const factor = new Map((ings ?? []).map((i) => [i.id, i.retail_factor === null ? null : Number(i.retail_factor)]));
  const groups = new Map<string, ObservationRow[]>();
  for (const o of obs ?? []) groups.set(`${o.ingredient_id}|${o.area_id}`, [...(groups.get(`${o.ingredient_id}|${o.area_id}`) ?? []), o]);
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
