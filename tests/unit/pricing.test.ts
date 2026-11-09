import { describe, expect, it } from 'vitest';
import { APP_CONFIG as CFG } from '@/lib/config/app.config';
import { costPlate } from '@/lib/pricing/costPlate';
import { derivePricePoint, estimateForArea } from '@/lib/pricing/pricePoints';
import type { Observation } from '@/lib/pricing/types';
import { cheapestUnits } from '@/lib/pricing/unitSolver';
import { book, C, EMPTY_HOUSE, INGREDIENTS, point, POINTS, TODAY } from '../fixtures/pricing';

const cost = (components = [C.jollof, C.chicken, C.dodo], people = 1, house = EMPTY_HOUSE, b = book()) => costPlate(components, people, house, b, TODAY, CFG)!;
const line = (plate: ReturnType<typeof cost>, id: string) => plate.lines.find((l) => l.ingredientId === id);

describe('costPlate (doc 04, section 4.6)', () => {
  it('jollof + chicken + dodo for 1 is dominated by minimum units and leaves rice over', () => {
    const p = cost();
    expect(line(p, 'rice')!.bought).toEqual([{ label: 'derica', count: 1, qty: 750 }]);
    expect(line(p, 'pepper-mix')!.bought[0].label).toBe('₦500 mix');
    expect(p.leftovers.map((l) => l.ingredientId)).toContain('rice');
    expect(p.outlayMidNgn).toBeGreaterThan(p.useCostNgn * 1.5);
  });

  it('the same plate for 5 costs less than 5 times the plate for 1', () => {
    expect(cost(undefined, 5).outlayMidNgn).toBeLessThan(5 * cost(undefined, 1).outlayMidNgn);
  });

  it('rice and oil in the house come off the outlay and show as "You have these"', () => {
    const p = cost(undefined, 1, { cooked: [], foodstuff: ['rice'], basic: ['veg-oil'] });
    expect(line(p, 'rice')).toBeUndefined();
    expect(line(p, 'veg-oil')).toBeUndefined();
    expect(p.pantryUsed).toEqual(expect.arrayContaining(['rice', 'veg-oil']));
  });

  it('egusi + eba for 1 buys a pot of egusi for 4, with a per-plate figure far below the outlay', () => {
    const p = cost([C.egusi, C.eba], 1);
    expect(p.pot).toEqual({ componentId: 'egusi-soup', servings: 4, moreMeals: 3 });
    expect(line(p, 'egusi')!.need).toBe(200);
    expect(line(p, 'garri')!.need).toBe(120);
    expect(p.perPlateNgn).toBeLessThan(p.outlayLowNgn / 2);
  });

  it('egusi + eba for 6 has no pot line', () => expect(cost([C.egusi, C.eba], 6).pot).toBeNull());

  it('rice + cooked stew from the house prices the rice only', () => {
    const p = cost([C.whiteRice, C.stew], 1, { cooked: ['tomato-stew'], foodstuff: [], basic: [] });
    expect(p.lines.map((l) => l.ingredientId)).toEqual(['rice']);
    expect(p.pantryUsed).toContain('tomato-stew');
    expect(p.pot).toBeNull();
  });

  it('jollof for 1 leaves rice for 3 more plates and shows the use line', () => {
    const p = cost([C.jollof], 1);
    expect(line(p, 'rice')!.leftoverPlates).toBe(3);
    expect(p.showUseLine).toBe(true);
  });

  it('never buys a wholesale unit', () => {
    for (const people of [1, 4, 12, 20]) {
      const labels = cost([C.jollof, C.chicken, C.dodo, C.stew], people).lines.flatMap((l) => l.bought.map((b) => b.label));
      expect(labels).not.toEqual(expect.arrayContaining(['50 kg bag', '25 L keg', 'basket']));
    }
  });

  it('a 45-day-old price makes the plate stale and low confidence, with the 0.25 spread', () => {
    const p = cost(undefined, 1, EMPTY_HOUSE, book({ ...POINTS, chicken: point(6, { asOf: '2026-10-06', confidence: 'low', srcSpread: 0.02 }) }));
    expect(p.freshness).toBe('stale');
    expect(p.confidence).toBe('low');
    expect(line(p, 'chicken')!.spread).toBe(0.25);
  });

  it('salt is assumed in every kitchen and never charged', () => {
    expect(line(cost([C.jollof]), 'salt')).toBeUndefined();
  });

  it('rounds the range outwards to ₦50', () => {
    const p = cost();
    expect(p.outlayLowNgn % 50).toBe(0);
    expect(p.outlayHighNgn % 50).toBe(0);
    expect(p.outlayLowNgn).toBeLessThanOrEqual(p.lines.reduce((s, l) => s + l.outlayLow, 0));
    expect(p.outlayHighNgn).toBeGreaterThanOrEqual(p.lines.reduce((s, l) => s + l.outlayHigh, 0));
  });

  it('refuses to price a draft line without a quantity, or an ingredient without a price', () => {
    expect(
      costPlate([{ id: 'x', batchServingsMin: 1, lines: [{ ingredientId: 'rice', qtyPerServing: null, group: null }] }], 1, EMPTY_HOUSE, book(), TODAY, CFG),
    ).toBeNull();
    const noRice = Object.fromEntries(Object.entries(POINTS).filter(([id]) => id !== 'rice'));
    expect(costPlate([C.whiteRice], 1, EMPTY_HOUSE, book(noRice), TODAY, CFG)).toBeNull();
  });
});

const obs = (priceNgn: number, over: Partial<Observation> = {}): Observation => ({
  priceNgn,
  unitQty: 1,
  observedOn: '2026-11-15',
  kind: 'market_check',
  sourceId: `src-${priceNgn}`,
  sourceName: 'Our market check, Mile 12',
  sourceWeight: 1,
  ...over,
});

describe('derivePricePoint (doc 04, section 3)', () => {
  it('takes the weighted middle: ₦112,000, ₦60,000 and ₦50,000 give ₦60,000, not ₦74,000', () => {
    const p = derivePricePoint([obs(112000), obs(60000), obs(50000)], TODAY, CFG)!;
    expect(p.mid).toBe(60000);
    expect(p.sources).toHaveLength(3);
    expect(p.sampleCount).toBe(3);
  });

  it('scout-only data never reaches high confidence, and the source bias is taken out', () => {
    const scout = (price: number, sourceId: string) =>
      obs(price, { kind: 'press_survey', sourceId, sourceName: 'Nairametrics', sourceWeight: 0.7, biasFactor: 1.12 });
    const p = derivePricePoint([scout(1120, 'a'), scout(1120, 'b'), scout(1120, 'a'), scout(1120, 'b')], TODAY, CFG)!;
    expect(p.confidence).toBe('medium');
    expect(p.mid).toBeCloseTo(1000);
  });

  it('five sources within 5% plus a market check sit at the confidence floor spread', () => {
    const p = derivePricePoint(
      [
        obs(100),
        obs(102, { kind: 'press_survey', sourceId: 'b', sourceWeight: 0.7 }),
        obs(103, { kind: 'press_survey', sourceId: 'c', sourceWeight: 0.7 }),
        obs(104, { kind: 'online_store', sourceId: 'd', sourceWeight: 0.4 }),
        obs(105, { kind: 'official_stats', sourceId: 'e', sourceWeight: 0.5 }),
      ],
      TODAY,
      CFG,
    )!;
    expect(p.confidence).toBe('high');
    const plate = costPlate(
      [{ id: 'x', batchServingsMin: 1, lines: [{ ingredientId: 'onion', qtyPerServing: 1, group: 'vegetable' }] }],
      1,
      EMPTY_HOUSE,
      book({ onion: p }),
      TODAY,
      CFG,
    )!;
    expect(plate.lines[0].spread).toBe(0.08);
  });

  it('two sources far apart (₦100 and ₦250) cap the spread at PRICE_SPREAD_MAX', () => {
    const p = derivePricePoint([obs(100), obs(250, { kind: 'press_survey', sourceId: 'b', sourceWeight: 1 })], TODAY, CFG)!;
    const plate = costPlate(
      [{ id: 'x', batchServingsMin: 1, lines: [{ ingredientId: 'onion', qtyPerServing: 1, group: 'vegetable' }] }],
      1,
      EMPTY_HOUSE,
      book({ onion: p }),
      TODAY,
      CFG,
    )!;
    expect(plate.lines[0].spread).toBe(0.35);
  });

  it('wholesale observations get the retail factor', () => {
    expect(derivePricePoint([obs(50000, { unitQty: 50000, wholesale: true })], TODAY, CFG)!.mid).toBeCloseTo(1.25);
  });

  it('drops outliers unless an admin confirmed them', () => {
    expect(derivePricePoint([obs(100), obs(100), obs(100), obs(1000)], TODAY, CFG)!.sampleCount).toBe(3);
    expect(derivePricePoint([obs(100), obs(100), obs(100), obs(1000, { confirmedOutlier: true })], TODAY, CFG)!.sampleCount).toBe(4);
  });

  it('extends a thin window to 60 days and drops confidence one level', () => {
    const p = derivePricePoint([obs(100, { observedOn: '2026-11-18' }), obs(100, { observedOn: '2026-10-05', sourceId: 'b' })], TODAY, CFG)!;
    expect(p.sampleCount).toBe(2);
    expect(p.confidence).toBe('low');
  });

  it('an unsurveyed state is Lagos times its factor, at most medium, flagged as an estimate', () => {
    const e = estimateForArea(point(100), 1.1);
    expect(e.mid).toBeCloseTo(110);
    expect(e.confidence).toBe('medium');
    expect(e.isEstimate).toBe(true);
    expect(cost([C.whiteRice], 1, EMPTY_HOUSE, book({ ...POINTS, rice: estimateForArea(POINTS.rice, 1.1) })).isEstimate).toBe(true);
  });
});

describe('cheapestUnits', () => {
  const price = (u: { qty: number; observedPriceNgn?: number }) => u.observedPriceNgn ?? u.qty;
  it('covers the need at the lowest cost, ties to fewer items', () => {
    const r = cheapestUnits(900, INGREDIENTS['pepper-mix'].units, price)!;
    expect(r.purchases).toEqual([
      { label: '₦500 mix', count: 1, qty: 300 },
      { label: '₦1,000 mix', count: 1, qty: 650 },
    ]);
  });
  it('returns null when only wholesale units exist', () => {
    expect(cheapestUnits(10, [{ label: '50 kg bag', qty: 50000, sellable: false }], price)).toBeNull();
  });
});
