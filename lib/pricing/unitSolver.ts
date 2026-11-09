import type { MarketUnit, Purchase } from './types';

const MAX_TYPES = 3; // doc 04, section 4.2: a small bounded search
const MAX_EACH = 6;

// Cheapest combination of sellable units whose total covers `need`; ties go to fewer items.
// Wholesale units (sellable = false) are never bought (D-16).
export function cheapestUnits(
  need: number,
  units: MarketUnit[],
  unitPrice: (u: MarketUnit) => number,
): { purchases: Purchase[]; cost: number; qty: number } | null {
  const sellable = units.filter((u) => u.sellable && u.qty > 0);
  if (!sellable.length) return null;
  if (need <= 0) return { purchases: [], cost: 0, qty: 0 };

  let best: { counts: number[]; cost: number; items: number } | null = null;
  const counts = new Array(sellable.length).fill(0);
  const walk = (i: number) => {
    if (i === sellable.length) {
      const qty = counts.reduce((s, c, k) => s + c * sellable[k].qty, 0);
      if (qty < need) return;
      const cost = counts.reduce((s, c, k) => s + c * unitPrice(sellable[k]), 0);
      const items = counts.reduce((s, c) => s + c, 0);
      if (!best || cost < best.cost - 1e-9 || (Math.abs(cost - best.cost) <= 1e-9 && items < best.items)) best = { counts: [...counts], cost, items };
      return;
    }
    for (let c = 0; c <= MAX_EACH; c++) {
      if (c > 0 && counts.slice(0, i).filter(Boolean).length >= MAX_TYPES) break;
      counts[i] = c;
      walk(i + 1);
    }
    counts[i] = 0;
  };
  walk(0);

  if (!best) {
    // Need beyond the search bounds (a very big pot): buy the cheapest-per-unit sellable unit only.
    const u = [...sellable].sort((a, b) => unitPrice(a) / a.qty - unitPrice(b) / b.qty)[0];
    const n = Math.ceil(need / u.qty);
    return { purchases: [{ label: u.label, count: n, qty: u.qty }], cost: n * unitPrice(u), qty: n * u.qty };
  }
  const chosen: { counts: number[]; cost: number } = best;
  const purchases = sellable.flatMap((u, k) => (chosen.counts[k] ? [{ label: u.label, count: chosen.counts[k], qty: u.qty }] : []));
  return { purchases, cost: chosen.cost, qty: purchases.reduce((s, p) => s + p.count * p.qty, 0) };
}
