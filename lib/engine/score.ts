// Scoring (doc 03, section 4). Every term is 0..1; weights blend from cold start to taste as signals grow.
import type { AppConfig } from '../config/app.config';
import type { PlateCost } from '../pricing/types';
import { isForgotten } from './candidates';
import { plateMinutes } from './filters';
import { meanPairing, plateComponents, plateTags } from './plate';
import type { Context, Plate, Snapshot } from './types';

type Cfg = Pick<AppConfig, 'SCORE_WEIGHTS' | 'FORGOTTEN_AFTER_DAYS' | 'EXTRA_COMPONENT_MINUTES'>;
type Term = keyof AppConfig['SCORE_WEIGHTS']['withSignals'];

const DEFAULT_MAX_MINUTES = 45; // time fit when the user set no maximum (doc 03, section 4, T)
const FRESHNESS = { fresh: 1, ageing: 0.7, stale: 0.3 } as const;
const clip = (n: number) => Math.min(1, Math.max(0, n));

export function weights(ctx: Context, cfg: Cfg): Record<Term, number> {
  const { withSignals, coldStart, blendSignals } = cfg.SCORE_WEIGHTS;
  const t = Math.min(1, ctx.signals.count / blendSignals);
  const w = Object.fromEntries(Object.keys(withSignals).map((k) => [k, coldStart[k as Term] * (1 - t) + withSignals[k as Term] * t])) as Record<Term, number>;
  if (!ctx.craving) [w.popularity, w.craving] = [w.popularity + w.craving, 0];
  if (!ctx.house.cooked.length && !ctx.house.foodstuff.length) [w.popularity, w.house] = [w.popularity + w.house, 0];
  const positive = Object.entries(w).reduce((s, [k, v]) => (k === 'stale' ? s : s + v), 0);
  for (const k of Object.keys(w) as Term[]) if (k !== 'stale') w[k] /= positive;
  return w;
}

export function scorePlate(
  snap: Snapshot,
  ctx: Context,
  plate: Plate,
  cost: PlateCost,
  stretch: boolean,
  main: string,
  cfg: Cfg,
): { score: number; forgotten: boolean } {
  const w = weights(ctx, cfg);
  const comps = plateComponents(plate).map((id) => snap.components.get(id)!);
  const tags = plateTags(snap, plate);

  const A = tags.reduce((s, t) => s + ((ctx.signals.affinities[t] ?? 0) + 1) / 2, 0) / tags.length;
  const B = stretch ? 0.5 : 0.6 + 0.4 * Math.min(1, cost.outlayMidNgn / ctx.budget);
  const P = snap.components.get(main)?.popularity ?? 0;
  const Q = meanPairing(snap, plateComponents(plate));
  const max = ctx.filters.maxMinutes ?? DEFAULT_MAX_MINUTES;
  const minutes = plateMinutes(comps, ctx, cfg);
  const T = ctx.weekend || minutes <= 0.7 * max ? 1 : minutes >= max ? 0.3 : 1 - (0.7 * (minutes - 0.7 * max)) / (0.3 * max);
  const F = FRESHNESS[cost.freshness];
  const forgotten = isForgotten(main, ctx, cfg);
  const G = forgotten ? 1 : 0;
  const share = (list: string[]) => (list.length ? list.filter((t) => tags.includes(t)).length / list.length : 0);
  const C = ctx.craving ? clip(share(ctx.craving.boostTags) - 0.5 * share(ctx.craving.avoidTags)) : 0;
  const totalUse = cost.useCostNgn + cost.houseUseNgn;
  const H = clip(0.6 * (plate.usesCooked ? 1 : 0) + 0.4 * (totalUse > 0 ? cost.houseUseNgn / totalUse : 0));
  const S = cost.freshness === 'stale' ? 1 : 0;

  const score =
    w.affinity * A +
    w.budgetFit * B +
    w.popularity * P +
    w.pairing * Q +
    w.timeFit * T +
    w.freshness * F +
    w.forgotten * G +
    w.craving * C +
    w.house * H -
    w.stale * S;
  return { score, forgotten };
}
