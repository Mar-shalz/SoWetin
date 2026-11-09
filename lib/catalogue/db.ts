import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { supabaseEnv } from '@/lib/db/env';
import type { EngineComponent, Snapshot, Template } from '@/lib/engine/types';
import type { MealTime } from '@/lib/engine/time';
import type { LineGroup, PriceBook, PricePoint, SourceKind } from '@/lib/pricing/types';

// The engine's snapshot and the price book, read from the database (doc 06: "Catalogue and price snapshot").
// Whoever asks decides what it holds: the public key sees published dishes only (BR-40); a signed-in admin or
// editor also sees drafts, through the same row-level security, so staff can preview dishes before publishing.
export type Display = { name: string; localName: string | null; picture: string | null; status: string; totalMinutes: number };
type Item = { id: string; name: string };
// S-024 chips: cooked dishes marked house_chip, and the foodstuff and kitchen basics people say they have (D-18).
export type HouseOptions = { cooked: Item[]; foodstuff: Item[]; basic: Item[] };
export type Catalogue = { snap: Snapshot; book: PriceBook; display: Map<string, Display>; names: Map<string, string>; drafts: boolean; house: HouseOptions };

const sortedKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const CACHE_MS = 60_000;
let publicCache: { at: number; cat: Promise<Catalogue | null> } | null = null;
let anon: SupabaseClient | null = null;

// The public key with no session: row-level security shows published dishes only.
export function publicClient(): SupabaseClient | null {
  const env = supabaseEnv();
  if (!env) return null;
  anon ??= createClient(env.url, env.key, { auth: { persistSession: false, autoRefreshToken: false } });
  return anon;
}

// shortcut: the public snapshot is cached 60 seconds; add the snapshot_version check (doc 06) when publishing gets busy.
export function publicCatalogue(): Promise<Catalogue | null> {
  if (publicCache && Date.now() - publicCache.at < CACHE_MS) return publicCache.cat;
  const client = publicClient();
  if (!client) return Promise.resolve(null);
  const cat = loadCatalogue(client).catch((e) => {
    console.error('catalogue', e);
    publicCache = null;
    return null;
  });
  publicCache = { at: Date.now(), cat };
  return cat;
}

type Row = Record<string, unknown>;
const must = <T>(r: { data: T | null; error: { message: string } | null }): T => {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
};

export async function loadCatalogue(client: SupabaseClient, area = C.DEFAULT_AREA): Promise<Catalogue> {
  const [components, ingredients, templates, pairings, defaults, points] = await Promise.all([
    client
      .from('components')
      .select(
        'id, name, local_names, types, region, cuisine_family, meal_times, total_minutes, spice_level, effort, tags, popularity_prior, protein_included, needs_sauce, vegetarian_ok, batch_servings_min, status, illustration_path, house_chip, component_ingredients(ingredient_id, optional, qty_per_serving, grp)',
      )
      .neq('status', 'retired'),
    client
      .from('ingredients')
      .select('id, name, allergens, may_contain, is_animal, canonical_unit, house_group, market_units(label, canonical_qty, sellable, is_minimum, area_id)'),
    client.from('plate_templates').select('key, meal_times, main_slot, slots'),
    client.from('pairings').select('component_a, component_b, score').eq('status', 'approved'),
    client.from('pairing_defaults').select('type_a, type_b, score'),
    client.from('price_points').select('*').eq('area_id', area),
  ]).then((all) => all.map((r) => must(r as { data: Row[] | null; error: { message: string } | null })));

  const snap: Snapshot = {
    components: new Map(
      components.map((c): [string, EngineComponent] => [
        c.id as string,
        {
          id: c.id as string,
          name: c.name as string,
          types: c.types as string[],
          region: c.region as string,
          cuisine: c.cuisine_family as string,
          mealTimes: c.meal_times as MealTime[],
          totalMinutes: c.total_minutes as number,
          spice: c.spice_level as number,
          effort: c.effort as number,
          tags: c.tags as string[],
          popularity: Number(c.popularity_prior),
          proteinIncluded: c.protein_included as boolean,
          needsSauce: c.needs_sauce as boolean,
          vegetarianOk: c.vegetarian_ok as boolean,
          batchServingsMin: c.batch_servings_min as number,
          lines: (c.component_ingredients as Row[]).map((l) => ({
            ingredientId: l.ingredient_id as string,
            optional: l.optional as boolean,
            qtyPerServing: l.qty_per_serving === null ? null : Number(l.qty_per_serving),
            group: l.grp as LineGroup | null,
          })),
        },
      ]),
    ),
    ingredients: new Map(
      ingredients.map((i) => [
        i.id as string,
        { id: i.id as string, allergens: i.allergens as string[], mayContain: i.may_contain as string[], animal: i.is_animal as boolean },
      ]),
    ),
    templates: templates.map((t): Template => ({
      key: t.key as string,
      mealTimes: t.meal_times as MealTime[],
      mainSlot: t.main_slot as string,
      slots: (t.slots as Row[]).map((s) => ({
        key: s.key as string,
        types: s.types as string[],
        min: s.min as number,
        max: s.max as number,
        requiresPairingWith: (s.requires_pairing_with as string | undefined) ?? undefined,
        minPairing: (s.min_pairing as number | undefined) ?? undefined,
      })),
    })),
    pairings: new Map(pairings.map((p) => [sortedKey(p.component_a as string, p.component_b as string), Number(p.score)])),
    pairingDefaults: new Map(defaults.map((d) => [sortedKey(d.type_a as string, d.type_b as string), Number(d.score)])),
  };

  const book: PriceBook = {
    points: Object.fromEntries(points.map((p) => [p.ingredient_id as string, toPoint(p)])),
    ingredients: Object.fromEntries(
      ingredients.map((i) => [
        i.id as string,
        {
          id: i.id as string,
          canonicalUnit: i.canonical_unit as 'g' | 'ml' | 'piece',
          units: (i.market_units as Row[])
            .filter((u) => u.area_id === area)
            .map((u) => ({ label: u.label as string, qty: Number(u.canonical_qty), sellable: u.sellable as boolean, isMinimum: u.is_minimum as boolean })),
        },
      ]),
    ),
  };

  const display = new Map(
    components.map((c): [string, Display] => [
      c.id as string,
      {
        name: c.name as string,
        localName: Object.values((c.local_names as Record<string, string>) ?? {})[0] ?? null,
        picture: (c.illustration_path as string | null) ?? null,
        status: c.status as string,
        totalMinutes: c.total_minutes as number,
      },
    ]),
  );
  return {
    snap,
    book,
    display,
    names: new Map(ingredients.map((i) => [i.id as string, i.name as string])),
    drafts: components.some((c) => c.status !== 'published'),
    house: {
      cooked: components.filter((c) => c.house_chip).map((c) => ({ id: c.id as string, name: c.name as string })),
      foodstuff: ingredients.filter((i) => i.house_group === 'foodstuff').map((i) => ({ id: i.id as string, name: i.name as string })),
      basic: ingredients.filter((i) => i.house_group === 'basic').map((i) => ({ id: i.id as string, name: i.name as string })),
    },
  };
}

// shortcut: the database keeps the source count and up to six named sources, not every source id, so plate-level
// source counts union the named ones; good enough until the scout adds many sources per ingredient.
function toPoint(p: Row): PricePoint {
  const shown = (p.sources_shown as { name: string; kind: SourceKind; observed_on: string; area?: string }[]) ?? [];
  return {
    low: Number(p.per_unit_low),
    mid: Number(p.per_unit_mid),
    high: Number(p.per_unit_high),
    confidence: p.confidence as PricePoint['confidence'],
    asOf: p.as_of as string,
    oldest: p.oldest as string,
    sampleCount: p.sample_count as number,
    sources: shown.map((s) => s.name),
    sourceKinds: (p.source_kinds as PricePoint['sourceKinds']) ?? {},
    sourcesShown: shown.map((s) => ({ name: s.name, kind: s.kind, observedOn: s.observed_on, area: s.area })),
    lastMarketCheck: (p.last_market_check as string | null) ?? null,
    srcSpread: Number(p.src_spread),
    isEstimate: p.is_estimate as boolean,
  };
}
