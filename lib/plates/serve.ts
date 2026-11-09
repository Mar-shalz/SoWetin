import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadCatalogue, publicCatalogue, publicClient, type Catalogue } from '@/lib/catalogue/db';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { pictureUrl } from '@/lib/db/env';
import { db } from '@/lib/db/server';
import { plateMinutes } from '@/lib/engine/filters';
import { plateComponents } from '@/lib/engine/plate';
import type { Context, CostFn, Plate, ScoredPlate } from '@/lib/engine/types';
import { costPlate } from '@/lib/pricing/costPlate';
import type { House, PlateCost } from '@/lib/pricing/types';

// Shared by the suggestions API and the plate page: which catalogue to use, how to cost a plate, what to send.

// Staff signed in with the second factor preview drafts; everyone else gets the cached public catalogue.
export async function catalogueForRequest(): Promise<{ cat: Catalogue | null; staff: boolean; client: SupabaseClient | null }> {
  const store = await cookies();
  if (store.getAll().some((c) => c.name.startsWith('sb-'))) {
    const supabase = await db();
    const user = supabase && (await supabase.auth.getUser()).data.user;
    if (supabase && user) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const { data: role } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
      if (aal?.currentLevel === 'aal2' && role) return { cat: await loadCatalogue(supabase), staff: true, client: supabase };
    }
  }
  return { cat: await publicCatalogue(), staff: false, client: publicClient() };
}

export const lagosToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: C.TIMEZONE }).format(new Date());

// Doc 04, section 4: the plate's lines, minus any optional ingredient dropped for the avoid list.
export function costFn(cat: Catalogue, people: number, house: House, today: string): CostFn {
  return (plate: Plate) =>
    costPlate(
      plateComponents(plate).map((id) => {
        const c = cat.snap.components.get(id)!;
        return {
          id,
          batchServingsMin: c.batchServingsMin,
          lines: c.lines
            .filter((l) => !plate.without.includes(l.ingredientId))
            .map((l) => ({ ingredientId: l.ingredientId, qtyPerServing: l.qtyPerServing, group: l.group })),
        };
      }),
      people,
      house,
      cat.book,
      today,
      C,
    );
}

// "{template}:{slot}={slug}[+{slug}],..." back into a plate, or null if it doesn't fit the catalogue.
export function parsePlateKey(key: string, cat: Catalogue): Plate | null {
  const [template, rest] = key.split(':');
  const tpl = cat.snap.templates.find((t) => t.key === template);
  if (!tpl || !rest) return null;
  const slots: Record<string, string[]> = {};
  for (const part of rest.split(',')) {
    const [slot, ids] = part.split('=');
    if (!tpl.slots.some((s) => s.key === slot) || !ids) return null;
    slots[slot] = ids.split('+');
    if (!slots[slot].every((id) => cat.snap.components.has(id))) return null;
  }
  return { template, slots, without: [], usesCooked: false };
}

export type PlateView = ReturnType<typeof plateView>;
export type Receipt = PlateView['price']['receipt'];

// S-023 "Where this price comes from": the plate's sources by kind, up to six named ones, the last market visit,
// and which ingredients make a wide range wide. Names only, never a link (doc 04, section 3, step 9).
export function receipt(cost: PlateCost, cat: Catalogue) {
  const points = cost.lines.map((l) => cat.book.points[l.ingredientId]).filter((p) => p !== undefined);
  const kinds = { market_check: 0, press_survey: 0, online_store: 0, official_stats: 0 };
  for (const p of points) for (const [k, n] of Object.entries(p.sourceKinds)) kinds[k as keyof typeof kinds] += n ?? 0;
  const seen = new Set<string>();
  const shown = points
    .flatMap((p) => p.sourcesShown)
    .sort((a, b) => b.observedOn.localeCompare(a.observedOn))
    .filter((s) => !seen.has(s.name) && seen.add(s.name))
    .slice(0, C.PRICE_SOURCES_SHOWN_MAX)
    .map((s) => ({ name: s.name, observed_on: s.observedOn }));
  const visits = points.map((p) => p.lastMarketCheck).filter((d): d is string => !!d);
  const spread = cost.outlayMidNgn ? (cost.outlayHighNgn - cost.outlayLowNgn) / (2 * cost.outlayMidNgn) : 0;
  return {
    kinds,
    shown,
    last_visit: visits.length === points.length && visits.length ? visits.sort().at(-1)! : null,
    wide_items:
      spread > C.PRICE_WIDE_SPREAD
        ? [...cost.lines]
            .sort((a, b) => b.spread - a.spread)
            .slice(0, 2)
            .map((l) => cat.names.get(l.ingredientId) ?? l.ingredientId)
        : [],
  };
}

// A plate rebuilt from its key, priced for this request, as the engine's swap needs it (BR-37).
export function scoredFromKey(key: string, cat: Catalogue, cost: CostFn, budget: number): ScoredPlate | null {
  const plate = parsePlateKey(key, cat);
  const c = plate && cost(plate);
  if (!plate || !c) return null;
  const tpl = cat.snap.templates.find((t) => t.key === plate.template)!;
  return {
    plate,
    key,
    main: plate.slots[tpl.mainSlot]?.[0] ?? '',
    cost: c,
    score: 0,
    stretch: c.outlayHighNgn > budget,
    gapNgn: Math.max(0, c.outlayHighNgn - budget),
    forgotten: false,
    newToUser: false,
  };
}

// What a plate card needs (doc 07, POST /suggestions), and nothing that names a wholesale unit (FR-027).
export function plateView(sp: ScoredPlate, cat: Catalogue, ctx: Pick<Context, 'house'>) {
  const ids = plateComponents(sp.plate);
  const tpl = cat.snap.templates.find((t) => t.key === sp.plate.template)!;
  const c = sp.cost;
  return {
    plate_key: sp.key,
    template: sp.plate.template,
    title: ids.map((id) => cat.display.get(id)?.name ?? id).join(' + '),
    slots: tpl.slots
      .filter((s) => sp.plate.slots[s.key]?.length)
      .flatMap((s) =>
        sp.plate.slots[s.key].map((id) => {
          const d = cat.display.get(id);
          return {
            slot: s.key,
            component: { id, name: d?.name ?? id, local_name: d?.localName ?? null, picture: pictureUrl(d?.picture ?? null), draft: d?.status !== 'published' },
          };
        }),
      ),
    price: {
      low_ngn: c.outlayLowNgn,
      high_ngn: c.outlayHighNgn,
      plate_use_ngn: c.plateUseNgn,
      per_plate_ngn: c.perPlateNgn,
      show_use_line: c.showUseLine,
      pot: c.pot ? { component: cat.display.get(c.pot.componentId)?.name ?? c.pot.componentId, servings: c.pot.servings, more_meals: c.pot.moreMeals } : null,
      confidence: c.confidence,
      freshness: c.freshness,
      checked_on: c.oldestPriceDate,
      is_estimate: c.isEstimate,
      source_count: c.sourceCount,
      stretch: sp.stretch,
      gap_ngn: sp.gapNgn,
      receipt: receipt(c, cat),
    },
    // The why line names house items first (doc 11): cooked food on the plate, then foodstuff it uses.
    uses_house: [
      ...ids.filter((id) => ctx.house.cooked.includes(id)).map((id) => cat.display.get(id)?.name ?? id),
      ...c.pantryUsed.map((id) => cat.names.get(id) ?? id),
    ],
    uses_cooked: ids.some((id) => ctx.house.cooked.includes(id)),
    total_minutes: plateMinutes(
      ids.map((id) => cat.snap.components.get(id)!),
      { house: ctx.house } as Context,
      C,
    ),
  };
}
