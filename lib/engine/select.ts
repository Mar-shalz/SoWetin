// Deck selection (doc 03, section 5) and the public entry points: suggest, Not this (BR-39).
import type { AppConfig } from '../config/app.config';
import { generateCandidates } from './candidates';
import { plateKey, plateTags } from './plate';
import { seededRandom } from './rng';
import { scorePlate } from './score';
import type { Context, CostFn, Deck, ScoredPlate, Snapshot } from './types';

type Cfg = AppConfig;

function similarity(snap: Snapshot, a: ScoredPlate, b: ScoredPlate, tags: Map<string, Set<string>>): number {
  if (a.main === b.main) return 1;
  if (a.plate.template === b.plate.template) return 0.6;
  if (snap.components.get(a.main)?.region === snap.components.get(b.main)?.region) return 0.4;
  const ta = tags.get(a.key)!;
  const tb = tags.get(b.key)!;
  const shared = [...ta].filter((t) => tb.has(t)).length;
  return shared / (ta.size + tb.size - shared);
}

export function selectDeck(snap: Snapshot, scored: ScoredPlate[], ctx: Context, cfg: Cfg, n: number): Deck {
  const rng = seededRandom(ctx.seed);
  const byScore = (a: ScoredPlate, b: ScoredPlate) => b.score - a.score;
  const inBudget = scored.filter((p) => p.gapNgn === 0).sort(byScore);
  const stretch = scored.filter((p) => p.stretch).sort(byScore);
  const tags = new Map(scored.map((p) => [p.key, new Set(plateTags(snap, p.plate))]));
  // BR-30 as hard rules: no shared main, at most MAX_SAME_PLATE_TYPE_PER_DECK of one plate type.
  const fits = (p: ScoredPlate, picks: ScoredPlate[]) =>
    !picks.some((q) => q.main === p.main) && picks.filter((q) => q.plate.template === p.plate.template).length < cfg.MAX_SAME_PLATE_TYPE_PER_DECK;

  if (!inBudget.length && !stretch.length) {
    // BR-16: nothing fits, so show the closest plates with their gap.
    const picks: ScoredPlate[] = [];
    for (const p of [...scored].sort((a, b) => a.cost.outlayHighNgn - b.cost.outlayHighNgn)) if (picks.length < n && fits(p, picks)) picks.push(p);
    return { plates: picks, tight: picks.length > 0, explored: false };
  }

  // Maximal marginal relevance: 0.7 × score − 0.3 × similarity to what's already picked.
  const picks: ScoredPlate[] = [];
  while (picks.length < n) {
    let best: ScoredPlate | null = null;
    let bestValue = -Infinity;
    for (const p of inBudget) {
      if (picks.includes(p) || !fits(p, picks)) continue;
      const value = 0.7 * p.score - 0.3 * Math.max(0, ...picks.map((q) => similarity(snap, p, q, tags)));
      if (value > bestValue) [best, bestValue] = [p, value];
    }
    if (!best) break;
    picks.push(best);
  }

  // BR-33: now and then, the lowest pick makes way for the best plate whose main the user has never seen.
  let explored = false;
  if (picks.length && rng() < cfg.EXPLORATION_RATE) {
    const rest = picks.slice(0, -1);
    const fresh = inBudget.find((p) => !picks.includes(p) && !ctx.signals.seenMains.includes(p.main) && fits(p, rest));
    if (fresh) [picks[picks.length - 1], explored] = [fresh, true];
  }

  // BR-15: stretch plates only fill a short deck, at most STRETCH_MAX_PER_DECK of them.
  for (const p of stretch) {
    if (picks.length >= n || picks.filter((q) => q.stretch).length >= cfg.STRETCH_MAX_PER_DECK) break;
    if (fits(p, picks)) picks.push(p);
  }

  // BR-131: food cooked and waiting fills at least HOUSE_COOKED_MIN_CARDS cards when it can, and leads the deck.
  if (ctx.house.cooked.length) {
    const want = Math.min(cfg.HOUSE_COOKED_MIN_CARDS, n);
    const pool = [...inBudget, ...stretch].filter((p) => p.plate.usesCooked);
    for (const p of pool) {
      if (picks.filter((q) => q.plate.usesCooked).length >= want) break;
      if (picks.includes(p)) continue;
      const victim = [...picks].reverse().find(
        (q) =>
          !q.plate.usesCooked &&
          fits(
            p,
            picks.filter((x) => x !== q),
          ),
      );
      if (victim) picks[picks.indexOf(victim)] = p;
      else if (picks.length < n && fits(p, picks)) picks.push(p);
    }
    const lead = picks.findIndex((q) => q.plate.usesCooked);
    if (lead > 0) picks.unshift(...picks.splice(lead, 1));
  }
  return { plates: picks, tight: false, explored };
}

export function scoreAll(snap: Snapshot, ctx: Context, cost: CostFn, cfg: Cfg): ScoredPlate[] {
  const templates = new Map(snap.templates.map((t) => [t.key, t]));
  const out: ScoredPlate[] = [];
  for (const plate of generateCandidates(snap, ctx, cfg)) {
    const c = cost(plate);
    if (!c) continue; // a plate the price engine can't price honestly is never shown
    const t = templates.get(plate.template)!;
    const main = plate.slots[t.mainSlot][0];
    const over = c.outlayHighNgn - ctx.budget;
    const stretch = over > 0 && c.outlayHighNgn <= ctx.budget * (1 + cfg.STRETCH_PCT / 100);
    const { score, forgotten } = scorePlate(snap, ctx, plate, c, stretch, main, cfg);
    out.push({
      plate,
      key: plateKey(plate, t),
      main,
      cost: c,
      score,
      stretch,
      gapNgn: Math.max(0, over),
      forgotten,
      newToUser: !ctx.signals.seenMains.includes(main),
    });
  }
  return out;
}

// "Show me 3" deals DECK_SIZE plates; "Pick for me" is the first plate of the same selection (BR-36).
export const suggest = (snap: Snapshot, ctx: Context, cost: CostFn, cfg: Cfg, n = cfg.DECK_SIZE): Deck =>
  selectDeck(snap, scoreAll(snap, ctx, cost, cfg), ctx, cfg, n);

// BR-39: "Not this" replaces one card with a plate whose main isn't on screen, or returns null to say nothing else fits.
export function replaceCard(snap: Snapshot, ctx: Context, onScreen: ScoredPlate[], cost: CostFn, cfg: Cfg): ScoredPlate | null {
  const mains = onScreen.map((p) => p.main);
  const deck = suggest(snap, { ...ctx, excludeMains: [...new Set([...ctx.excludeMains, ...mains])] }, cost, cfg, 1);
  const next = deck.plates[0];
  return next && !deck.tight && !mains.includes(next.main) ? next : null;
}
