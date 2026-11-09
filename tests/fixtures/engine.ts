import { readFileSync } from 'node:fs';
import { snapshotFromSeeds } from '@/lib/catalogue/snapshot';
import type { CatalogueSeed, IngredientsSeed } from '@/lib/catalogue/types';
import type { Context, CostFn, Snapshot } from '@/lib/engine/types';
import type { PlateCost } from '@/lib/pricing/types';

const read = (f: string) => JSON.parse(readFileSync(new URL(`../../data/${f}`, import.meta.url), 'utf8'));
export const CATALOGUE: CatalogueSeed = read('catalogue-seed.json');
export const INGREDIENTS: IngredientsSeed = read('ingredients-seed.json');
export const SNAP: Snapshot = snapshotFromSeeds(CATALOGUE, INGREDIENTS);

export const ctxOf = (over: Partial<Context> = {}): Context => ({
  now: '2026-11-20T13:00:00+01:00',
  mealTime: 'lunch',
  weekend: false,
  budget: 5000,
  people: 1,
  filters: {},
  avoid: { ingredients: [], allergens: [] },
  allergy: { ingredients: [], allergens: [], seasoningCubesOk: false },
  house: { cooked: [], foodstuff: [], basic: [] },
  excludeMains: [],
  signals: { affinities: {}, count: 0, ateAt: {}, dislikedUntil: {}, lastPositiveAt: {}, seenMains: [] },
  seed: 'test',
  ...over,
});

// Stand-in for costPlate while the seeds have no quantities: a fixed price per component by effort; cooked food is free.
export const fakeCost =
  (snap: Snapshot, ctx: Context): CostFn =>
  (plate) => {
    const ids = Object.values(plate.slots)
      .flat()
      .filter((id) => !ctx.house.cooked.includes(id));
    const mid = ids.reduce((s, id) => s + 300 + 400 * snap.components.get(id)!.effort, 0);
    const cost: PlateCost = {
      outlayLowNgn: Math.floor((mid * 0.9) / 50) * 50,
      outlayHighNgn: Math.ceil((mid * 1.1) / 50) * 50,
      outlayMidNgn: mid,
      useCostNgn: mid * 0.7,
      houseUseNgn: 0,
      plateUseNgn: mid * 0.7,
      perPlateNgn: mid * 0.7,
      pot: null,
      showUseLine: true,
      confidence: 'high',
      freshness: 'fresh',
      oldestPriceDate: '2026-11-18',
      sourceCount: 3,
      isEstimate: false,
      pantryUsed: [],
      leftovers: [],
      lines: [],
    };
    return cost;
  };
