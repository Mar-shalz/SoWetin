import type { Snapshot } from '@/lib/engine/types';

export type AllergenGroup = { tag: string; items: string[] };

// S-004 item 9 and S-011: "Contains: fish (stockfish), crustacean (crayfish). May contain: gluten (seasoning cubes)."
// Built from our own recipe lines, optional ones included, the same lines the allergy filter reads (doc 05, 2.4).
// An allergen already listed under "Contains" isn't repeated under "May contain".
export function allergenLine(ids: string[], snap: Snapshot, names: Map<string, string>): { contains: AllergenGroup[]; may: AllergenGroup[] } {
  const contains = new Map<string, Set<string>>();
  const may = new Map<string, Set<string>>();
  const add = (to: Map<string, Set<string>>, tag: string, item: string) => to.set(tag, (to.get(tag) ?? new Set()).add(item));
  for (const id of ids)
    for (const line of snap.components.get(id)?.lines ?? []) {
      const ing = snap.ingredients.get(line.ingredientId);
      if (!ing) continue;
      const name = names.get(ing.id) ?? ing.id;
      for (const a of ing.allergens) add(contains, a, name);
      for (const a of ing.mayContain) add(may, a, name);
    }
  const list = (m: Map<string, Set<string>>, skip: Map<string, Set<string>>) =>
    [...m].filter(([tag]) => !skip.has(tag)).map(([tag, items]) => ({ tag, items: [...items] }));
  return { contains: list(contains, new Map()), may: list(may, contains) };
}

// Every allergen tag the catalogue uses, for labels on Chef's allergy box.
export const allergenTags = (snap: Snapshot) => [...new Set([...snap.ingredients.values()].flatMap((i) => [...i.allergens, ...i.mayContain]))].sort();
