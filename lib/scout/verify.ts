import { normalise } from './text';

// Doc 04, section 6.3, step 4: an observation the AI read is kept only if our code can check every part of it
// against the page. Anything that fails is rejected with a reason, for review in A-04.
export type Extracted = { ingredient: string; unit_text: string; price_ngn: number; market: string; area: string; period: string; quote: string };
export type Unit = { label: string; qty: number };
export type IngredientInfo = { canonicalUnit: 'g' | 'ml' | 'piece'; units: Unit[] };
export type Kept = {
  ingredient_id: string;
  unit_label: string;
  unit_canonical_qty: number;
  price_ngn: number;
  observed_on: string;
  market: string;
  source_quote: string;
};
export type Verdict = { ok: true; row: Kept } | { ok: false; reason: string };

// Every price written in a quote, the way reports write them: "N105,000", "₦1.5k", "2 million".
export function pricesIn(quote: string): number[] {
  const out: number[] = [];
  for (const m of normalise(quote).matchAll(/(\d+(?:\.\d+)?)\s?(k|m|million)?\b/g)) {
    const n = Number(m[1]) * (m[2] === 'k' ? 1_000 : m[2] ? 1_000_000 : 1);
    if (Number.isInteger(n)) out.push(n);
  }
  return out;
}

const SIZE = /(\d+(?:\.\d+)?)\s?(kg|kilo(?:gram)?s?|g|grams?|l|litres?|liters?|cl|ml)\b/;
const FACTOR: Record<string, [number, 'g' | 'ml']> = {
  kg: [1000, 'g'],
  kilo: [1000, 'g'],
  g: [1, 'g'],
  gram: [1, 'g'],
  l: [1000, 'ml'],
  litre: [1000, 'ml'],
  liter: [1000, 'ml'],
  cl: [10, 'ml'],
  ml: [1, 'ml'],
};

// The unit in the ingredient's own measure (g, ml or piece): a market unit we know, a stated size, or a crate or dozen.
export function unitQty(unitText: string, info: IngredientInfo): number | null {
  const text = normalise(unitText);
  const known = info.units.find((u) => normalise(u.label) === text);
  if (known) return known.qty;
  const m = text.match(SIZE);
  if (m) {
    const word = m[2].replace(/s$/, '').replace('kilogram', 'kilo');
    const [factor, unit] = FACTOR[word] ?? [0, 'g'];
    return factor && unit === info.canonicalUnit ? Number(m[1]) * factor : null;
  }
  if (info.canonicalUnit === 'piece') {
    if (/\bcrate\b/.test(text)) return 30;
    if (/\bdozen\b/.test(text)) return 12;
    const pieces = text.match(/^(\d+)\s?(pieces?|tubers?|bunch(?:es)?)?$/);
    if (pieces) return Number(pieces[1]);
  }
  return null;
}

// A month ("2026-09") counts from its middle, so a report for September is neither too young nor too old.
export function periodDate(period: string): string | null {
  const m = period.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3] ?? '15'}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

export function verify(o: Extracted, page: string, info: IngredientInfo | undefined, today: string, maxAgeDays: number): Verdict {
  if (!info) return { ok: false, reason: 'unknown ingredient' };
  if (!normalise(page).includes(normalise(o.quote))) return { ok: false, reason: 'quote not on the page' };
  if (!pricesIn(o.quote).includes(o.price_ngn)) return { ok: false, reason: 'price not in the quote' };
  const qty = unitQty(o.unit_text, info);
  if (!qty) return { ok: false, reason: 'unit not convertible' };
  const on = periodDate(o.period);
  if (!on) return { ok: false, reason: 'no date' };
  const age = (Date.parse(today) - Date.parse(on)) / 86_400_000;
  if (age < -1) return { ok: false, reason: 'date in the future' };
  if (age > maxAgeDays) return { ok: false, reason: 'too old' };
  // shortcut: Lagos only while the app serves Lagos; national figures and other states come with state factors.
  if (!/lagos/i.test(o.area)) return { ok: false, reason: 'not Lagos' };
  return {
    ok: true,
    row: {
      ingredient_id: o.ingredient,
      unit_label: o.unit_text.trim(),
      unit_canonical_qty: qty,
      price_ngn: o.price_ngn,
      observed_on: on,
      market: o.market.trim() || 'Lagos',
      source_quote: o.quote.trim(),
    },
  };
}
