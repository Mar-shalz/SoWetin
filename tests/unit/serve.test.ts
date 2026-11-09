import { describe, expect, it } from 'vitest';
import type { Catalogue } from '@/lib/catalogue/db';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { suggest } from '@/lib/engine/select';
import type { EngineComponent } from '@/lib/engine/types';
import { swapSlot } from '@/lib/engine/swap';
import { costFn, parsePlateKey, plateView, receipt, scoredFromKey } from '@/lib/plates/serve';
import { INGREDIENTS, SNAP, ctxOf } from '../fixtures/engine';

// The real costing on the real seed catalogue, once every line has an amount and every ingredient a price.
const point = { low: 1.8, mid: 2, high: 2.2, confidence: 'high' as const, asOf: '2026-11-18', oldest: '2026-11-18', sampleCount: 3 };
const cat: Catalogue = {
  snap: {
    ...SNAP,
    components: new Map(
      [...SNAP.components].map(([id, c]): [string, EngineComponent] => [id, { ...c, lines: c.lines.map((l) => ({ ...l, qtyPerServing: 40, group: 'base' })) }]),
    ),
  },
  book: {
    points: Object.fromEntries(
      INGREDIENTS.ingredients.map((i) => [
        i.slug,
        { ...point, sources: ['a', 'b'], sourceKinds: { market_check: 3 }, sourcesShown: [], lastMarketCheck: '2026-11-18', srcSpread: 0.1, isEstimate: false },
      ]),
    ),
    ingredients: Object.fromEntries(
      INGREDIENTS.ingredients.map((i) => [
        i.slug,
        {
          id: i.slug,
          canonicalUnit: i.canonical_unit,
          units:
            i.canonical_unit === 'piece'
              ? [{ label: '1 piece', qty: 1, sellable: true, isMinimum: true }]
              : [
                  { label: 'small pack', qty: 250, sellable: true, isMinimum: true },
                  { label: '50 kg bag', qty: 50000, sellable: false },
                ],
        },
      ]),
    ),
  },
  display: new Map(
    [...SNAP.components].map(([id, c]) => [id, { name: c.name, localName: null, picture: null, status: 'draft', totalMinutes: c.totalMinutes }]),
  ),
  names: new Map(INGREDIENTS.ingredients.map((i) => [i.slug, i.name])),
  drafts: true,
  house: { cooked: [], foodstuff: [], basic: [] },
};

describe('suggestions served from the database catalogue', () => {
  const ctx = ctxOf({ budget: 20000 });
  const deck = suggest(cat.snap, ctx, costFn(cat, 1, ctx.house, '2026-11-20'), C, 3);

  it('returns priced plates within budget, as ranges, with keys that read back', () => {
    expect(deck.plates.length).toBe(3);
    for (const sp of deck.plates) {
      const v = plateView(sp, cat, ctx);
      expect(v.price.low_ngn).toBeLessThanOrEqual(v.price.high_ngn);
      expect(v.price.low_ngn % C.PRICE_ROUNDING_NGN).toBe(0);
      expect(v.title).toBe(v.slots.map((x) => x.component.name).join(' + '));
      expect(v.slots.every((s) => s.component.draft)).toBe(true);
      expect(parsePlateKey(v.plate_key, cat)?.slots).toEqual(sp.plate.slots);
    }
  });

  it('never sends a wholesale unit to the client (FR-027)', () => {
    expect(JSON.stringify(deck.plates.map((sp) => plateView(sp, cat, ctx)))).not.toContain('50 kg bag');
  });

  it('refuses plate keys that do not fit the catalogue', () => {
    expect(parsePlateKey('nope:main=egusi-soup', cat)).toBeNull();
    expect(parsePlateKey(`${cat.snap.templates[0].key}:main=not-a-dish`, cat)).toBeNull();
    expect(parsePlateKey('no-colon', cat)).toBeNull();
  });

  it('prices nothing when a line has no amount, instead of guessing', () => {
    const bare = { ...cat, snap: SNAP };
    expect(suggest(bare.snap, ctx, costFn(bare, 1, ctx.house, '2026-11-20'), C, 3).plates).toEqual([]);
  });

  it('swaps one dish and keeps the rest of the plate (A-26)', () => {
    const cost = costFn(cat, 1, ctx.house, '2026-11-20');
    const multi =
      deck.plates.find((sp) => Object.keys(sp.plate.slots).length > 1) ??
      suggest(cat.snap, { ...ctx, filters: { plateTypes: ['soup_swallow'] } }, cost, C, 1).plates[0];
    const current = scoredFromKey(multi.key, cat, cost, ctx.budget)!;
    const tpl = cat.snap.templates.find((t) => t.key === current.plate.template)!;
    const other = tpl.slots.find((s) => s.key !== tpl.mainSlot && current.plate.slots[s.key]?.length)!;
    const next = swapSlot(cat.snap, ctx, current, other.key, cost, C)!;
    expect(next.plate.slots[other.key]).not.toEqual(current.plate.slots[other.key]);
    expect(next.plate.slots[tpl.mainSlot]).toEqual(current.plate.slots[tpl.mainSlot]);
  });

  it('builds the price receipt from the sources behind the plate (S-023)', () => {
    const r = receipt(deck.plates[0].cost, cat);
    expect(r.kinds.market_check).toBeGreaterThan(0);
    expect(r.last_visit).toBe('2026-11-18');
    expect(r.shown).toEqual([]);
  });
});
