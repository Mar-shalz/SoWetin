import type { AppConfig } from '../config/app.config';
import { daysBetween, roundDown, roundNearest, roundUp } from './rounding';
import { cheapestUnits } from './unitSolver';
import type { Confidence, CostComponent, CostLine, Freshness, House, LineGroup, PlateCost, PriceBook } from './types';

type Cfg = Pick<
  AppConfig,
  | 'SEASONING_SCALE_EXPONENT'
  | 'PRICE_SPREAD'
  | 'PRICE_SPREAD_MAX'
  | 'PRICE_ROUNDING_NGN'
  | 'USE_COST_LINE_THRESHOLD'
  | 'FRESH_DAYS'
  | 'AGEING_DAYS'
  | 'LEFTOVER_SHOW_PCT'
  | 'ALWAYS_IN_KITCHEN'
>;

const SIGNIFICANT_SHARE = 0.1; // lines worth 10% or more of the outlay set confidence, freshness and source count (doc 04, 4.3)
const ORDER: Confidence[] = ['low', 'medium', 'high'];

// D-17: soups and stews are cooked as a pot.
export const cookServings = (c: CostComponent, people: number) => Math.max(people, c.batchServingsMin);
const scale = (n: number, group: LineGroup | null, exp: number) => (group === 'seasoning' || group === 'oil' ? n ** exp : n);

// Doc 04, section 4. Returns null when the plate can't be priced honestly (a line without a quantity or a price).
export function costPlate(components: CostComponent[], people: number, house: House, book: PriceBook, today: string, cfg: Cfg): PlateCost | null {
  const cooked = new Set(house.cooked);
  const assumed = new Set(cfg.ALWAYS_IN_KITCHEN);
  const have = new Set([...house.foodstuff, ...house.basic]);
  const foodstuff = new Set(house.foodstuff);
  const pantryUsed = new Set<string>();
  let houseUse = 0; // value of house foodstuff this plate uses; the engine's H score term (doc 03, section 4)
  const merged = new Map<string, { need: number; qtyPerServing: number; group: LineGroup | null }>();
  const pots: { c: CostComponent; servings: number; needs: Map<string, number> }[] = [];

  for (const c of components) {
    if (cooked.has(c.id)) {
      pantryUsed.add(c.id); // cooked and waiting costs nothing today (doc 04, 4.4)
      continue;
    }
    const servings = cookServings(c, people);
    const needs = new Map<string, number>();
    for (const l of c.lines) {
      if (assumed.has(l.ingredientId)) continue;
      if (have.has(l.ingredientId)) {
        pantryUsed.add(l.ingredientId);
        const mid = book.points[l.ingredientId]?.mid;
        if (foodstuff.has(l.ingredientId) && l.qtyPerServing != null && mid)
          houseUse += l.qtyPerServing * scale(servings, l.group, cfg.SEASONING_SCALE_EXPONENT) * mid;
        continue;
      }
      if (l.qtyPerServing == null) return null;
      const need = l.qtyPerServing * scale(servings, l.group, cfg.SEASONING_SCALE_EXPONENT);
      needs.set(l.ingredientId, (needs.get(l.ingredientId) ?? 0) + need);
      const m = merged.get(l.ingredientId) ?? { need: 0, qtyPerServing: l.qtyPerServing, group: l.group };
      m.need += need;
      merged.set(l.ingredientId, m);
    }
    pots.push({ c, servings, needs });
  }

  const lines: CostLine[] = [];
  for (const [ingredientId, m] of merged) {
    const point = book.points[ingredientId];
    const ingredient = book.ingredients[ingredientId];
    if (!point || !ingredient) return null;
    const buy = cheapestUnits(m.need, ingredient.units, (u) => u.observedPriceNgn ?? u.qty * point.mid);
    if (!buy) return null;
    const spread = Math.max(cfg.PRICE_SPREAD[point.confidence], Math.min(point.srcSpread, cfg.PRICE_SPREAD_MAX));
    const leftover = buy.qty - m.need;
    const show = leftover > 0 && leftover >= (cfg.LEFTOVER_SHOW_PCT / 100) * buy.qty;
    lines.push({
      ingredientId,
      need: m.need,
      bought: buy.purchases,
      outlayMid: buy.cost,
      outlayLow: buy.cost * (1 - spread),
      outlayHigh: buy.cost * (1 + spread),
      useCost: m.need * point.mid,
      spread,
      confidence: point.confidence,
      asOf: point.asOf,
      leftoverQty: show ? leftover : 0,
      leftoverPlates: show && m.group === 'base' ? Math.floor(leftover / m.qtyPerServing) : 0,
    });
  }

  const sum = (f: (l: CostLine) => number) => lines.reduce((s, l) => s + f(l), 0);
  const outlayMid = sum((l) => l.outlayMid);
  const significant = lines.filter((l) => l.outlayMid >= SIGNIFICANT_SHARE * outlayMid);
  const confidence = significant.reduce<Confidence>((c, l) => (ORDER.indexOf(l.confidence) < ORDER.indexOf(c) ? l.confidence : c), 'high');
  const oldestPriceDate = significant.map((l) => l.asOf).sort()[0] ?? today;
  const age = daysBetween(oldestPriceDate, today);
  const freshness: Freshness = age <= cfg.FRESH_DAYS ? 'fresh' : age <= cfg.AGEING_DAYS ? 'ageing' : 'stale';

  // D-16, doc 04 4.2a: what this meal uses, with a pot's cost shared across every meal it makes.
  const mid = (id: string) => book.points[id].mid;
  const plateUse = pots.reduce((s, p) => {
    const use = [...p.needs].reduce((t, [id, need]) => t + need * mid(id), 0);
    return s + (p.servings > people ? (use * people) / p.servings : use);
  }, 0);
  const potComponent = pots.filter((p) => p.servings > people).sort((a, b) => b.servings - a.servings)[0];
  const step = cfg.PRICE_ROUNDING_NGN;

  return {
    outlayLowNgn: roundDown(
      sum((l) => l.outlayLow),
      step,
    ),
    outlayHighNgn: roundUp(
      sum((l) => l.outlayHigh),
      step,
    ),
    outlayMidNgn: outlayMid,
    useCostNgn: sum((l) => l.useCost),
    houseUseNgn: houseUse,
    plateUseNgn: roundNearest(plateUse, step),
    perPlateNgn: roundNearest(plateUse / people, step),
    pot: potComponent ? { componentId: potComponent.c.id, servings: potComponent.servings, moreMeals: potComponent.servings - people } : null,
    showUseLine: plateUse <= cfg.USE_COST_LINE_THRESHOLD * outlayMid,
    confidence,
    freshness,
    oldestPriceDate,
    sourceCount: new Set(significant.flatMap((l) => book.points[l.ingredientId].sources)).size,
    isEstimate: lines.some((l) => book.points[l.ingredientId].isEstimate),
    pantryUsed: [...pantryUsed],
    leftovers: lines.filter((l) => l.leftoverQty > 0).map((l) => ({ ingredientId: l.ingredientId, qty: l.leftoverQty, plates: l.leftoverPlates })),
    lines,
  };
}
