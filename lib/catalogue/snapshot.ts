// Builds the engine's read-only snapshot from the seed files. The database loader (M1, with Supabase) returns the same shape.
import type { Snapshot } from '../engine/types';
import type { CatalogueSeed, IngredientsSeed } from './types';

export function snapshotFromSeeds(cat: CatalogueSeed, ing: IngredientsSeed): Snapshot {
  const sortedKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  return {
    components: new Map(
      cat.components.map((c) => [
        c.slug,
        {
          id: c.slug,
          name: c.name,
          types: c.types,
          region: c.region,
          cuisine: c.cuisine_family,
          mealTimes: c.meal_times,
          totalMinutes: c.total_minutes,
          spice: c.spice_level,
          effort: c.effort,
          tags: c.tags,
          popularity: c.popularity_prior,
          proteinIncluded: c.protein_included,
          needsSauce: c.needs_sauce,
          vegetarianOk: c.vegetarian_ok,
          batchServingsMin: c.batch_servings_min,
          lines: c.ingredient_lines.map((l) => ({
            ingredientId: l.ingredient,
            optional: l.optional,
            qtyPerServing: l.qty_per_serving,
            group: l.group as never,
          })),
        },
      ]),
    ),
    ingredients: new Map(ing.ingredients.map((i) => [i.slug, { id: i.slug, allergens: i.allergens, mayContain: i.may_contain, animal: i.animal }])),
    templates: cat.plate_templates.map((t) => ({
      key: t.key,
      mealTimes: t.meal_times,
      mainSlot: t.main_slot,
      slots: t.slots.map((s) => ({
        key: s.key,
        types: s.types,
        min: s.min,
        max: s.max,
        requiresPairingWith: s.requires_pairing_with,
        minPairing: s.min_pairing,
      })),
    })),
    pairings: new Map(cat.pairings.map((p) => [sortedKey(p.a, p.b), p.score])),
    pairingDefaults: new Map(cat.pairing_defaults.map((d) => [sortedKey(d.a, d.b), d.score])),
  };
}
