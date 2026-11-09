// Hard filters (BR-31, doc 03 section 2.4, doc 05 section 2.4). Allergy safety is absolute: when in doubt, exclude.
import type { AppConfig } from '../config/app.config';
import { daysBetween } from '../pricing/rounding';
import type { MealTime } from './time';
import type { Context, EngineComponent, Snapshot } from './types';

const SEASONING_CUBE = 'seasoning-cube'; // the allergy screen's "Seasoning cubes are fine for me" (doc 05, 2.4)

export type FilterResult = { ok: false } | { ok: true; without: string[] };
const NO: FilterResult = { ok: false };

// Per component: allergy, avoid, vegetarian, meal time, spice and time. Returns the optional lines dropped for avoid or vegetarian.
export function componentPasses(c: EngineComponent, snap: Snapshot, ctx: Context, mealTime: MealTime): FilterResult {
  const allergyIngredients = new Set(ctx.allergy.ingredients);
  const allergyTags = new Set(ctx.allergy.allergens);
  const avoidIngredients = new Set(ctx.avoid.ingredients);
  const avoidTags = new Set(ctx.avoid.allergens);
  const without: string[] = [];
  if (ctx.craving?.exclude?.includes(c.id)) return NO; // "no beans"

  for (const line of c.lines) {
    const ing = snap.ingredients.get(line.ingredientId);
    if (!ing) return NO; // an ingredient we can't see can't be proven safe
    // Allergy (sensitive): any line, optional or not, and any "may contain" excludes the component.
    if (allergyIngredients.has(ing.id) || ing.allergens.some((a) => allergyTags.has(a))) return NO;
    if (!(ctx.allergy.seasoningCubesOk && ing.id === SEASONING_CUBE) && ing.mayContain.some((a) => allergyTags.has(a))) return NO;
    // Avoid (preference) and vegetarian: an essential match excludes, an optional match is dropped from the recipe.
    const avoided = avoidIngredients.has(ing.id) || ing.allergens.some((a) => avoidTags.has(a)) || (!!ctx.filters.vegetarian && ing.animal);
    if (avoided) {
      if (!line.optional) return NO;
      without.push(ing.id);
    }
  }
  if (ctx.filters.vegetarian && !c.vegetarianOk) return NO;
  if (!c.mealTimes.includes(mealTime)) return NO;
  if (ctx.filters.spiceMax != null && c.spice > ctx.filters.spiceMax) return NO;
  if (ctx.filters.maxMinutes != null && c.totalMinutes > ctx.filters.maxMinutes) return NO;
  return { ok: true, without };
}

// Rules that apply to the main only: already shown, eaten in the last REPEAT_BLOCK_DAYS, or disliked.
// Food cooked and waiting in the house is never blocked by the repeat rule (BR-32a).
export function mainBlocked(c: EngineComponent, ctx: Context, cfg: Pick<AppConfig, 'REPEAT_BLOCK_DAYS'>): boolean {
  if (ctx.excludeMains.includes(c.id)) return true;
  const disliked = ctx.signals.dislikedUntil[c.id];
  if (disliked && disliked > ctx.now) return true;
  const ate = ctx.signals.ateAt[c.id];
  return !ctx.house.cooked.includes(c.id) && !!ate && daysBetween(ate.slice(0, 10), ctx.now.slice(0, 10)) < cfg.REPEAT_BLOCK_DAYS;
}

// Plate time: the longest component plus EXTRA_COMPONENT_MINUTES per extra component that still needs cooking.
export function plateMinutes(components: EngineComponent[], ctx: Context, cfg: Pick<AppConfig, 'EXTRA_COMPONENT_MINUTES'>): number {
  const toCook = components.filter((c) => c.totalMinutes > 0 && !ctx.house.cooked.includes(c.id));
  if (!toCook.length) return 0;
  return Math.max(...toCook.map((c) => c.totalMinutes)) + cfg.EXTRA_COMPONENT_MINUTES * (toCook.length - 1);
}
