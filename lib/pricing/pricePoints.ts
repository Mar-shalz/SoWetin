import type { AppConfig } from '../config/app.config';
import { daysBetween } from './rounding';
import type { Confidence, Observation, PricePoint, SourceKind } from './types';

type Cfg = Pick<AppConfig, 'AGEING_DAYS' | 'FRESH_DAYS' | 'RETAIL_FACTOR_DEFAULT' | 'PRICE_SOURCES_SHOWN_MAX'>;

const EXTENDED_WINDOW_DAYS = 60; // doc 04, section 3, step 1
const OUTLIER_HIGH = 2.5; // step 5
const OUTLIER_LOW = 0.4;
const LEVELS: Confidence[] = ['low', 'medium', 'high'];
const lower = (c: Confidence): Confidence => LEVELS[Math.max(0, LEVELS.indexOf(c) - 1)];

type Weighted = { o: Observation; v: number; w: number };

// Weighted percentile over values sorted ascending. Landing exactly between two values takes their middle.
function percentile(sorted: Weighted[], p: number): number {
  const target = p * sorted.reduce((s, x) => s + x.w, 0);
  let acc = 0;
  for (let i = 0; i < sorted.length; i++) {
    acc += sorted[i].w;
    if (Math.abs(acc - target) < 1e-9 && i + 1 < sorted.length) return (sorted[i].v + sorted[i + 1].v) / 2;
    if (acc > target) return sorted[i].v;
  }
  return sorted[sorted.length - 1].v;
}

// Doc 04, section 3: observations for one ingredient in one area become a price per canonical unit with a receipt.
export function derivePricePoint(observations: Observation[], today: string, cfg: Cfg, retailFactor?: number | null): PricePoint | null {
  const age = (o: Observation) => daysBetween(o.observedOn, today);
  let window = observations.filter((o) => age(o) >= 0 && age(o) <= cfg.AGEING_DAYS);
  const extended = window.length < 2;
  if (extended) window = observations.filter((o) => age(o) >= 0 && age(o) <= EXTENDED_WINDOW_DAYS);
  if (!window.length) return null;

  const all: Weighted[] = window.map((o) => {
    let v = o.priceNgn / o.unitQty;
    if (o.wholesale) v *= retailFactor ?? cfg.RETAIL_FACTOR_DEFAULT;
    if (o.kind !== 'market_check' && o.biasFactor) v /= o.biasFactor;
    return { o, v, w: o.sourceWeight };
  });
  const plain = [...all].sort((a, b) => a.v - b.v);
  const median = plain.length % 2 ? plain[(plain.length - 1) / 2].v : (plain[plain.length / 2 - 1].v + plain[plain.length / 2].v) / 2;
  const used = plain.filter((x) => x.o.confirmedOutlier || (x.v <= OUTLIER_HIGH * median && x.v >= OUTLIER_LOW * median));

  const mid = percentile(used, 0.5);
  const [low, high] = used.length === 1 ? [mid, mid] : [percentile(used, 0.25), percentile(used, 0.75)];

  const sources = [...new Set(used.map((x) => x.o.sourceId))];
  const fresh = (x: Weighted) => age(x.o) <= cfg.FRESH_DAYS;
  const scoutOnly = used.every((x) => x.o.kind !== 'market_check');
  let confidence: Confidence = 'low';
  if (used.some((x) => x.o.kind === 'market_check' && fresh(x)) && used.length >= 3 && sources.length >= 2) confidence = 'high';
  else if (used.filter((x) => age(x.o) <= cfg.AGEING_DAYS).length >= 2 || (scoutOnly && used.some((x) => x.o.kind === 'press_survey' && fresh(x))))
    confidence = 'medium';
  if (extended) confidence = lower(confidence);

  const dates = used.map((x) => x.o.observedOn).sort();
  const sourceKinds: Partial<Record<SourceKind, number>> = {};
  for (const x of used) sourceKinds[x.o.kind] = (sourceKinds[x.o.kind] ?? 0) + 1;
  const newestFirst = [...used].sort((a, b) => b.o.observedOn.localeCompare(a.o.observedOn));
  const shown = newestFirst
    .filter((x, i) => newestFirst.findIndex((y) => y.o.sourceId === x.o.sourceId) === i)
    .slice(0, cfg.PRICE_SOURCES_SHOWN_MAX)
    .map(({ o }) => ({ name: o.sourceName, kind: o.kind, observedOn: o.observedOn, area: o.area }));

  return {
    low,
    mid,
    high,
    confidence,
    asOf: dates[dates.length - 1],
    oldest: dates[0],
    sampleCount: used.length,
    sources,
    sourceKinds,
    sourcesShown: shown,
    lastMarketCheck: newestFirst.find((x) => x.o.kind === 'market_check')?.o.observedOn ?? null,
    srcSpread: (high - low) / (2 * mid),
    isEstimate: false,
  };
}

// BR-23: an unsurveyed state is priced from Lagos times its state factor, never above medium confidence.
export function estimateForArea(lagos: PricePoint, stateFactor: number): PricePoint {
  return {
    ...lagos,
    low: lagos.low * stateFactor,
    mid: lagos.mid * stateFactor,
    high: lagos.high * stateFactor,
    confidence: lagos.confidence === 'high' ? 'medium' : lagos.confidence,
    isEstimate: true,
  };
}
