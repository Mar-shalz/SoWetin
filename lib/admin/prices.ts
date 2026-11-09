import type { AppConfig } from '@/lib/config/app.config';
import { derivePricePoint } from '@/lib/pricing/pricePoints';
import type { Observation } from '@/lib/pricing/types';

// Market check import (doc 04, section 7) and price point rows (section 3). Pure: the admin action does the IO.
export const CSV_HEADER = ['observed_on', 'area_slug', 'market', 'ingredient_slug', 'unit_label', 'unit_canonical_qty', 'price_ngn', 'source', 'notes'];
const SOURCES = ['retail_survey', 'wholesale_survey'] as const;

// RFC 4180 CSV: commas, quotes and line breaks inside "quoted" fields, "" for a quote. Fits Google Sheets exports.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch !== '"') field += ch;
      else if (text[i + 1] === '"') field += text[i++];
      else quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      rows.push([...row, field]);
      row = [];
      field = '';
    } else field += ch;
  }
  rows.push([...row, field]);
  return rows.filter((r) => r.some((c) => c.trim()));
}

export type Known = {
  areas: Set<string>;
  ingredients: Map<string, string>; // id → name
  units: Map<string, number>; // `${ingredient}|${area}|${label}` → canonical quantity
  mids: Map<string, number>; // `${ingredient}|${area}` → current mid per canonical unit
};
export type Row = {
  line: number;
  ingredient_id: string;
  area_id: string;
  market: string;
  unit_label: string;
  unit_canonical_qty: number;
  weighed: boolean; // the sheet gave a weighing, so the unit's quantity updates
  price_ngn: number;
  observed_on: string;
  source: (typeof SOURCES)[number];
  notes: string | null;
  changePct: number | null; // against the current mid, when there is one
};
export type Problem = { line: number; reason: 'columns' | 'date' | 'area' | 'ingredient' | 'unit' | 'price' | 'qty' | 'source'; hint?: string };
export type Report = { rows: Row[]; problems: Problem[]; flagged: Row[] };

const num = (s: string) => Number(s.replace(/[₦,\s]/g, ''));

export function checkImport(text: string, known: Known, today: string, cfg: Pick<AppConfig, 'IMPORT_FLAG_CHANGE_PCT' | 'RETAIL_FACTOR_DEFAULT'>): Report {
  const report: Report = { rows: [], problems: [], flagged: [] };
  const all = parseCsv(text);
  const first = all[0]?.map((c) => c.trim().toLowerCase());
  const skip = first && first[0] === CSV_HEADER[0] ? 1 : 0;
  all.slice(skip).forEach((cells, i) => {
    const line = i + 1 + skip;
    const bad = (reason: Problem['reason'], hint?: string) => report.problems.push({ line, reason, hint });
    if (cells.length < 8) return bad('columns');
    const [observed_on, area_id, market, ingredient_id, unit_label, qtyText, priceText, source, notes] = cells.map((c) => c.trim());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(observed_on) || Number.isNaN(Date.parse(observed_on)) || observed_on > today) return bad('date');
    if (!known.areas.has(area_id)) return bad('area');
    if (!known.ingredients.has(ingredient_id)) return bad('ingredient', suggest(ingredient_id, known));
    const unitKey = `${ingredient_id}|${area_id}|${unit_label}`;
    if (!known.units.has(unitKey)) {
      const labels = [...known.units.keys()].filter((k) => k.startsWith(`${ingredient_id}|${area_id}|`)).map((k) => k.split('|')[2]);
      return bad('unit', labels.join(', '));
    }
    const weighed = qtyText !== '';
    const qty = weighed ? num(qtyText) : known.units.get(unitKey)!;
    if (!(qty > 0)) return bad('qty');
    const price = num(priceText);
    if (!Number.isInteger(price) || price <= 0) return bad('price');
    if (!(SOURCES as readonly string[]).includes(source)) return bad('source');
    const mid = known.mids.get(`${ingredient_id}|${area_id}`);
    const perUnit = (price / qty) * (source === 'wholesale_survey' ? cfg.RETAIL_FACTOR_DEFAULT : 1);
    const changePct = mid ? Math.round((Math.abs(perUnit - mid) / mid) * 100) : null;
    const row: Row = {
      line,
      ingredient_id,
      area_id,
      market,
      unit_label,
      unit_canonical_qty: qty,
      weighed,
      price_ngn: price,
      observed_on,
      source: source as Row['source'],
      notes: notes || null,
      changePct,
    };
    report.rows.push(row);
    if (changePct !== null && changePct > cfg.IMPORT_FLAG_CHANGE_PCT) report.flagged.push(row);
  });
  return report;
}

// "Did you mean" for a mistyped ingredient: the first catalogue ingredient sharing the slug's first word.
function suggest(slug: string, known: Known): string | undefined {
  const word = slug.split('-')[0].toLowerCase();
  if (!word) return undefined;
  for (const [id, name] of known.ingredients) if (id.startsWith(word) || name.toLowerCase().includes(word)) return id;
  return undefined;
}

export type ObservationRow = {
  price_ngn: number;
  unit_canonical_qty: number | null;
  observed_on: string;
  market: string | null;
  source: string;
  confirmed_outlier: boolean;
};

// Market checks weigh 1.0 and each market counts as its own source (doc 04, section 3, step 6).
// shortcut: only market checks become price points; scout and partner rows join when the price scout lands.
export function toObservation(r: ObservationRow): Observation | null {
  if (!(SOURCES as readonly string[]).includes(r.source) || !r.unit_canonical_qty) return null;
  const market = r.market || 'Lagos';
  return {
    priceNgn: r.price_ngn,
    unitQty: Number(r.unit_canonical_qty),
    observedOn: r.observed_on,
    kind: 'market_check',
    sourceId: `market:${market.toLowerCase()}`,
    sourceName: `Our market check, ${market}`,
    sourceWeight: 1,
    wholesale: r.source === 'wholesale_survey',
    confirmedOutlier: r.confirmed_outlier,
  };
}

// The price_points row for one ingredient in one area, or null when no observation is recent enough.
export function pricePointRow(
  ingredient_id: string,
  area_id: string,
  rows: ObservationRow[],
  retailFactor: number | null,
  today: string,
  cfg: Pick<AppConfig, 'AGEING_DAYS' | 'FRESH_DAYS' | 'RETAIL_FACTOR_DEFAULT' | 'PRICE_SOURCES_SHOWN_MAX'>,
) {
  const obs = rows.map(toObservation).filter((o): o is Observation => o !== null);
  const p = derivePricePoint(obs, today, cfg, retailFactor);
  if (!p) return null;
  return {
    ingredient_id,
    area_id,
    per_unit_low: p.low,
    per_unit_mid: p.mid,
    per_unit_high: p.high,
    confidence: p.confidence,
    as_of: p.asOf,
    oldest: p.oldest,
    sample_count: p.sampleCount,
    is_estimate: p.isEstimate,
    source_count: p.sources.length,
    source_kinds: p.sourceKinds,
    sources_shown: p.sourcesShown.map((s) => ({ name: s.name, kind: s.kind, observed_on: s.observedOn, area: s.area ?? area_id })),
    last_market_check: p.lastMarketCheck,
    src_spread: Math.min(9.999, Math.round(p.srcSpread * 1000) / 1000),
  };
}
