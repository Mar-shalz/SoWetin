import type { Catalogue } from '@/lib/catalogue/db';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import type { EngineComponent } from '@/lib/engine/types';
import { costPlate } from '@/lib/pricing/costPlate';

// Explore shelves (doc 05, section 2.2), as rules over the catalogue the visitor may see.
export type Item = {
  id: string;
  name: string;
  localName: string | null;
  aliases: string[];
  picture: string | null;
  minutes: number;
  popularity: number;
  price1: number | null;
};
type Rule = (c: EngineComponent, i: Item, forgotten: boolean) => boolean;
const regions =
  (...r: string[]): Rule =>
  (c) =>
    r.includes(c.region);
const under =
  (n: number): Rule =>
  (_, i) =>
    i.price1 !== null && i.price1 <= n;

export const SHELVES = {
  swallow: (c) => c.types.some((t) => t === 'soup' || t === 'swallow'),
  rice: (c) => c.types.includes('rice'),
  one_pot: (c) => c.types.includes('one_pot'),
  breakfast: (c) => c.mealTimes.includes('breakfast'),
  snacks: (c) => c.types.includes('snack'),
  west: regions('yoruba'),
  east: regions('igbo'),
  north: regions('northern'),
  south_south: regions('niger_delta', 'edo'),
  efik: regions('efik_ibibio'),
  west_african: (c) => c.cuisine === 'west_african',
  africa: (c) => ['east_african', 'southern_african', 'north_african'].includes(c.cuisine),
  continental: (c) => c.cuisine === 'continental',
  under_2000: under(2000),
  under_3500: under(3500),
  under_5000: under(5000),
  quick: (c) => c.totalMinutes <= 30,
  forgotten: (_, __, f) => f,
  late_night: (c) => c.tags.includes('late_night_friendly'),
} satisfies Record<string, Rule>;
export type ShelfKey = keyof typeof SHELVES;
export const SHELF_KEYS = Object.keys(SHELVES) as ShelfKey[];

// Every dish with what a card needs, priced for 1 when it has amounts and prices (the "Under ₦…" shelves).
export function items(cat: Catalogue, today: string): (Item & { component: EngineComponent; forgotten: boolean })[] {
  return [...cat.snap.components.values()].map((c) => {
    const d = cat.display.get(c.id);
    const cost = costPlate(
      [{ id: c.id, batchServingsMin: 1, lines: c.lines.map((l) => ({ ingredientId: l.ingredientId, qtyPerServing: l.qtyPerServing, group: l.group })) }],
      1,
      { cooked: [], foodstuff: [], basic: [] },
      cat.book,
      today,
      C,
    );
    return {
      id: c.id,
      name: c.name,
      localName: d?.localName ?? null,
      aliases: d?.aliases ?? [],
      picture: d?.picture ?? null,
      minutes: c.totalMinutes,
      popularity: c.popularity,
      price1: cost?.outlayHighNgn ?? null,
      component: c,
      forgotten: !!d?.forgotten,
    };
  });
}

type Full = ReturnType<typeof items>[number];
const plainItem = (i: Full): Item => ({
  id: i.id,
  name: i.name,
  localName: i.localName,
  aliases: i.aliases,
  picture: i.picture,
  minutes: i.minutes,
  popularity: i.popularity,
  price1: i.price1,
});
export const plain = (all: Full[]): Item[] => all.map(plainItem);
export const shelf = (all: Full[], key: ShelfKey): Item[] => all.filter((i) => SHELVES[key](i.component, i, i.forgotten)).map(plainItem);
