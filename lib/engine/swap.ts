// Slot swap (BR-37, doc 03 section 5): the best alternative for one slot; every other slot stays (A-26).
import type { AppConfig } from '../config/app.config';
import { templateMealTime } from './candidates';
import { componentPasses, mainBlocked } from './filters';
import { pairing, plateComponents, plateKey } from './plate';
import { scorePlate } from './score';
import type { Context, CostFn, Plate, ScoredPlate, Snapshot } from './types';

export function swapSlot(
  snap: Snapshot,
  ctx: Context,
  current: ScoredPlate,
  slotKey: string,
  cost: CostFn,
  cfg: AppConfig,
  shownForSlot: string[] = [],
): ScoredPlate | null {
  const t = snap.templates.find((x) => x.key === current.plate.template);
  const slot = t?.slots.find((s) => s.key === slotKey);
  if (!t || !slot) return null;
  const mealTime = templateMealTime(t, ctx) ?? ctx.mealTime;
  const inSlot = current.plate.slots[slotKey] ?? [];
  const others = plateComponents(current.plate).filter((id) => !inSlot.includes(id));
  const limit = ctx.budget * (current.stretch ? 1 + cfg.STRETCH_PCT / 100 : 1);
  let best: ScoredPlate | null = null;

  for (const c of snap.components.values()) {
    if (!c.types.some((ty) => slot.types.includes(ty)) || inSlot.includes(c.id) || others.includes(c.id) || shownForSlot.includes(c.id)) continue;
    if (!componentPasses(c, snap, ctx, mealTime).ok) continue;
    if (slotKey === t.mainSlot && mainBlocked(c, ctx, cfg)) continue;
    if (others.some((o) => pairing(snap, c.id, o) < cfg.MIN_PAIRING_SCORE)) continue;
    const anchor = slot.requiresPairingWith ? current.plate.slots[slot.requiresPairingWith]?.[0] : null;
    if (anchor && pairing(snap, c.id, anchor) < (slot.minPairing ?? 0)) continue;

    const slots = { ...current.plate.slots, [slotKey]: [c.id] };
    const without = Object.values(slots)
      .flat()
      .flatMap((id) => {
        const r = componentPasses(snap.components.get(id)!, snap, ctx, mealTime);
        return r.ok ? r.without : [];
      });
    const plate: Plate = { ...current.plate, slots, without: [...new Set(without)] };
    const priced = cost(plate);
    if (!priced || priced.outlayHighNgn > limit) continue;
    const main = slots[t.mainSlot][0];
    const stretch = priced.outlayHighNgn > ctx.budget;
    const { score, forgotten } = scorePlate(snap, ctx, plate, priced, stretch, main, cfg);
    if (!best || score > best.score)
      best = { plate, key: plateKey(plate, t), main, cost: priced, score, stretch, gapNgn: 0, forgotten, newToUser: !ctx.signals.seenMains.includes(main) };
  }
  return best;
}
