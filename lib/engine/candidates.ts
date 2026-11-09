// Candidate generation (doc 03, section 2.3): templates × mains × best partners, plus plates built around cooked food.
import type { AppConfig } from '../config/app.config';
import { daysBetween } from '../pricing/rounding';
import { componentPasses, mainBlocked, plateMinutes, type FilterResult } from './filters';
import { pairing, plateKey } from './plate';
import type { MealTime } from './time';
import type { Context, EngineComponent, Plate, Slot, Snapshot, Template } from './types';

type Cfg = Pick<
  AppConfig,
  | 'REPEAT_BLOCK_DAYS'
  | 'FORGOTTEN_AFTER_DAYS'
  | 'ENGINE_TOP_MAINS'
  | 'ENGINE_TOP_PARTNERS'
  | 'ENGINE_MAX_CANDIDATES'
  | 'MIN_PAIRING_SCORE'
  | 'EXTRA_COMPONENT_MINUTES'
>;

const CRAVING_MEAL_ORDER: MealTime[] = ['dinner', 'lunch', 'breakfast', 'late_night']; // A-30

const ownTags = (c: EngineComponent) => [...c.tags, `cuisine:${c.cuisine}`, `region:${c.region}`, ...c.types.map((t) => `type:${t}`)];
export function affinity01(c: EngineComponent, ctx: Context): number {
  const tags = ownTags(c);
  return tags.reduce((s, t) => s + ((ctx.signals.affinities[t] ?? 0) + 1) / 2, 0) / tags.length;
}

// BR-34: saved, cooked, ordered or eaten before, but not in the last FORGOTTEN_AFTER_DAYS.
export function isForgotten(id: string, ctx: Context, cfg: Pick<AppConfig, 'FORGOTTEN_AFTER_DAYS'>): boolean {
  const last = ctx.signals.lastPositiveAt[id];
  return !!last && daysBetween(last.slice(0, 10), ctx.now.slice(0, 10)) > cfg.FORGOTTEN_AFTER_DAYS;
}

// The meal time a template is filled for: the current one, or for a craving that names it, the first it allows (A-30).
export function templateMealTime(t: Template, ctx: Context): MealTime | null {
  if (t.mealTimes.includes(ctx.mealTime)) return ctx.mealTime;
  if (ctx.craving?.plateTypes.includes(t.key)) return CRAVING_MEAL_ORDER.find((m) => t.mealTimes.includes(m)) ?? null;
  return null;
}

const fits = (c: EngineComponent, slot: Slot) => c.types.some((t) => slot.types.includes(t));

export function generateCandidates(snap: Snapshot, ctx: Context, cfg: Cfg): Plate[] {
  const out = new Map<string, Plate>();
  const all = [...snap.components.values()];

  for (const t of snap.templates) {
    if (ctx.filters.plateTypes?.length && !ctx.filters.plateTypes.includes(t.key)) continue;
    if (ctx.craving?.plateTypes.length && !ctx.craving.plateTypes.includes(t.key)) continue;
    const mealTime = templateMealTime(t, ctx);
    if (!mealTime) continue;
    const checked = new Map<string, FilterResult>();
    const pass = (c: EngineComponent) => {
      if (!checked.has(c.id)) checked.set(c.id, componentPasses(c, snap, ctx, mealTime));
      return checked.get(c.id)!;
    };
    const comp = (id: string) => snap.components.get(id)!;
    const mainSlot = t.slots.find((s) => s.key === t.mainSlot)!;
    const proteinOff = (slots: Record<string, string[]>) =>
      Object.values(slots)
        .flat()
        .some((id) => comp(id).proteinIncluded);

    // Partners for a slot, ranked by pairing with what they must pair with × (0.6 + 0.4 × affinity).
    const partners = (slot: Slot, slots: Record<string, string[]>, k: number): string[] => {
      const on = Object.values(slots).flat();
      const anchor = slots[slot.requiresPairingWith ?? t.mainSlot]?.[0];
      if (!anchor || (slot.key === 'protein' && proteinOff(slots))) return [];
      return all
        .filter((c) => fits(c, slot) && !on.includes(c.id) && pass(c).ok)
        .map((c) => ({ id: c.id, p: pairing(snap, c.id, anchor), a: affinity01(c, ctx) }))
        .filter((x) => x.p > 0 && x.p >= (slot.minPairing ?? 0))
        .sort((x, y) => y.p * (0.6 + 0.4 * y.a) - x.p * (0.6 + 0.4 * x.a))
        .slice(0, k)
        .map((x) => x.id);
    };

    const emit = (slots: Record<string, string[]>, usesCooked: boolean) => {
      const ids = Object.values(slots).flat();
      if (ctx.filters.maxMinutes != null && plateMinutes(ids.map(comp), ctx, cfg) > ctx.filters.maxMinutes) return;
      const plate: Plate = {
        template: t.key,
        slots,
        without: [...new Set(ids.flatMap((id) => (pass(comp(id)) as { without: string[] }).without))],
        usesCooked,
      };
      const key = plateKey(plate, t);
      const seen = out.get(key);
      if (!seen) out.set(key, plate);
      else if (usesCooked) seen.usesCooked = true;
    };

    const build = (locked: Record<string, string[]>, usesCooked: boolean) => {
      const main = comp(locked[t.mainSlot][0]);
      for (const s of t.slots) {
        const other = s.requiresPairingWith && locked[s.key] ? locked[s.requiresPairingWith]?.[0] : null;
        if (other && pairing(snap, locked[s.key][0], other) < (s.minPairing ?? 0)) return;
      }
      const required = t.slots.filter((s) => s.key !== t.mainSlot && !locked[s.key] && (s.min >= 1 || (s.key === 'sauce' && main.needsSauce)));
      let bases: Record<string, string[]>[] = [locked];
      for (const s of required) bases = bases.flatMap((b) => partners(s, b, cfg.ENGINE_TOP_PARTNERS).map((p) => ({ ...b, [s.key]: [p] })));
      const optional = t.slots.filter((s) => s.key !== t.mainSlot && !required.includes(s));
      for (const bare of bases) {
        emit(bare, usesCooked);
        const full = { ...bare };
        for (const s of optional) if (!full[s.key]) partners(s, full, 1).forEach((p) => (full[s.key] = [p]));
        emit(full, usesCooked);
        // A second soup only where the slot allows two and the pair is explicit, like Ewedu + Gbegiri (doc 03, 2.3).
        if (mainSlot.max >= 2) {
          const second = all.find(
            (c) => fits(c, mainSlot) && c.id !== main.id && pass(c).ok && (snap.pairings.get([main.id, c.id].sort().join('|')) ?? 0) >= cfg.MIN_PAIRING_SCORE,
          );
          if (second) emit({ ...full, [t.mainSlot]: [main.id, second.id] }, usesCooked);
        }
      }
    };

    const mains = all
      .filter((c) => fits(c, mainSlot) && pass(c).ok && !mainBlocked(c, ctx, cfg) && (!ctx.filters.regions?.length || ctx.filters.regions.includes(c.region)))
      .map((c) => ({ c, pre: 0.5 * affinity01(c, ctx) + 0.3 * c.popularity + 0.2 * (isForgotten(c.id, ctx, cfg) ? 1 : 0) }))
      .sort((a, b) => b.pre - a.pre)
      .slice(0, cfg.ENGINE_TOP_MAINS)
      .map((x) => x.c);
    for (const m of mains) build({ [t.mainSlot]: [m.id] }, false);

    // D-18: food cooked and waiting gets plates built around it, locked in its slot. So does a dish the craving names.
    const around = (id: string, usesCooked: boolean) => {
      const locked = snap.components.get(id);
      if (!locked || !pass(locked).ok) return;
      for (const s of t.slots) {
        if (!fits(locked, s)) continue;
        if (s.key === t.mainSlot) {
          if (!mainBlocked(locked, ctx, cfg)) build({ [s.key]: [id] }, usesCooked);
        } else for (const m of mains) if (pairing(snap, m.id, id) > 0) build({ [t.mainSlot]: [m.id], [s.key]: [id] }, usesCooked);
      }
    };
    for (const id of ctx.house.cooked) around(id, true);
    for (const id of ctx.craving?.include ?? []) around(id, false);
  }

  const include = ctx.craving?.include ?? [];
  const plates = [...out.values()].filter((p) => !include.length || Object.values(p.slots).some((ids) => ids.some((id) => include.includes(id))));
  if (plates.length <= cfg.ENGINE_MAX_CANDIDATES) return plates;
  const cooked = plates.filter((p) => p.usesCooked);
  return [...cooked, ...plates.filter((p) => !p.usesCooked).slice(0, Math.max(0, cfg.ENGINE_MAX_CANDIDATES - cooked.length))];
}
