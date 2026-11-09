import { z } from 'zod';
import type { Catalogue } from '@/lib/catalogue/db';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { mealTimeAt, type MealTime } from '@/lib/engine/time';
import type { Context } from '@/lib/engine/types';

// The part of every plate request that sets the scene (doc 07, section 4): money, people, mode, meal time, filters.
// Unknown fields are rejected (doc 07, section 3).
const MEALS = ['breakfast', 'lunch', 'dinner', 'late_night'] as const satisfies readonly MealTime[];
const slugs = z
  .array(z.string().regex(/^[a-z0-9-]{1,80}$/))
  .max(60)
  .default([]);
const tags = z
  .array(z.string().regex(/^[a-z_]{1,40}$/))
  .max(6)
  .default([]);
export const Scene = z
  .object({
    budget_ngn: z.int().min(C.BUDGET_MIN).max(C.BUDGET_MAX),
    people: z.int().min(C.PEOPLE_MIN).max(C.PEOPLE_MAX),
    mode: z.enum(['cook', 'buy']),
    meal_time: z.enum(MEALS).nullable().default(null),
    filters: z
      .object({
        plate_types: z
          .array(z.string().regex(/^[a-z_]{1,40}$/))
          .max(12)
          .default([]),
        max_total_minutes: z.int().min(5).max(600).nullable().default(null),
        spice_max: z.int().min(0).max(3).nullable().default(null),
        vegetarian: z.boolean().default(false),
      })
      .strict()
      .default({ plate_types: [], max_total_minutes: null, spice_max: null, vegetarian: false }),
    // A parsed craving (S-008): tags to favour or avoid, plate types, and dishes named or ruled out. Unknown ids match nothing.
    craving: z
      .object({
        boost_tags: tags,
        avoid_tags: tags,
        plate_types: z.array(z.string().regex(/^[a-z_]{1,40}$/)).max(4).default([]),
        include_components: slugs,
        exclude_components: slugs,
      })
      .strict()
      .nullable()
      .default(null),
    // What's in the house (S-024), kept on the phone until accounts arrive; ignored in buy mode (doc 07).
    house: z.object({ cooked: slugs, foodstuff: slugs, basic: slugs }).strict().default({ cooked: [], foodstuff: [], basic: [] }),
  })
  .strict();
export type SceneIn = z.infer<typeof Scene>;

export const error = (status: number, code: string, message: string) =>
  Response.json({ error: { code, message } }, { status, headers: { 'cache-control': 'no-store' } });

// shortcut: no profile yet, so no taste signals, avoid list or allergies; those arrive with accounts (M3).
export function contextFor(s: SceneIn, cat: Catalogue, seed: string, excludeMains: string[] = []): Context {
  const now = new Date();
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: C.TIMEZONE, weekday: 'short' }).format(now);
  const types = s.filters.plate_types.filter((k) => cat.snap.templates.some((t) => t.key === k));
  return {
    now: now.toISOString(),
    mealTime: s.meal_time ?? mealTimeAt(now, C.MEAL_WINDOWS, C.TIMEZONE),
    weekend: day === 'Sat' || day === 'Sun',
    budget: s.budget_ngn,
    people: s.people,
    filters: {
      plateTypes: types.length ? types : undefined,
      maxMinutes: s.filters.max_total_minutes ?? undefined,
      spiceMax: s.filters.spice_max ?? undefined,
      vegetarian: s.filters.vegetarian || undefined,
    },
    avoid: { ingredients: [], allergens: [] },
    allergy: { ingredients: [], allergens: [], seasoningCubesOk: false },
    house: s.mode === 'cook' ? s.house : { cooked: [], foodstuff: [], basic: [] },
    excludeMains,
    craving: s.craving
      ? {
          boostTags: s.craving.boost_tags,
          avoidTags: s.craving.avoid_tags,
          plateTypes: s.craving.plate_types,
          include: s.craving.include_components,
          exclude: s.craving.exclude_components,
        }
      : undefined,
    signals: { affinities: {}, count: 0, ateAt: {}, dislikedUntil: {}, lastPositiveAt: {}, seenMains: [] },
    seed,
  };
}
