import seed from '@/data/catalogue-seed.json';
import type { GameDish } from '@/lib/engine/persona';

// The Chop Personality deck is dealt from the whole catalogue in the seed, published or not: the game only shows dish
// names, which aren't a recipe or a price. Sides, sauces and breakfast partners aren't plates people say yum to.
const NOT_PLATES = new Set(['side', 'sauce', 'breakfast_partner']);
type Seed = { slug: string; name: string; types: string[]; tags: string[]; region: string; spice_level: number; total_minutes: number; meal_times: string[] };

export const POOL: (GameDish & { name: string })[] = (seed.components as Seed[])
  .filter((c) => c.types.some((t) => !NOT_PLATES.has(t)))
  .map((c) => ({ id: c.slug, name: c.name, types: c.types, tags: c.tags, region: c.region, spice: c.spice_level, minutes: c.total_minutes, mealTimes: c.meal_times }));
export const POOL_BY_ID = new Map(POOL.map((d) => [d.id, d]));

// A shared link carries the deck as slugs joined by dots; anything that isn't a pool dish is dropped.
export const parseDeck = (raw: string | undefined) => [...new Set((raw ?? '').split('.').filter((id) => POOL_BY_ID.has(id)))];
