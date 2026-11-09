import { describe, expect, it } from 'vitest';
import { APP_CONFIG as CFG } from '@/lib/config/app.config';
import { generateCandidates } from '@/lib/engine/candidates';
import { pairing, plateComponents } from '@/lib/engine/plate';
import { personaFor } from '@/lib/engine/persona';
import { replaceCard, scoreAll, selectDeck, suggest } from '@/lib/engine/select';
import { swapSlot } from '@/lib/engine/swap';
import { updateAffinity } from '@/lib/engine/taste';
import type { MealTime } from '@/lib/engine/time';
import type { Context } from '@/lib/engine/types';
import { CATALOGUE, ctxOf, fakeCost, INGREDIENTS, SNAP } from '../fixtures/engine';

const deal = (over: Partial<Context> = {}, n?: number) => {
  const ctx = ctxOf(over);
  return { ctx, deck: suggest(SNAP, ctx, fakeCost(SNAP, ctx), CFG, n) };
};
const MEALS: MealTime[] = ['breakfast', 'lunch', 'dinner', 'late_night'];
const ingredient = new Map(INGREDIENTS.ingredients.map((i) => [i.slug, i]));
const component = new Map(CATALOGUE.components.map((c) => [c.slug, c]));

describe('allergy safety over the full catalogue (doc 15, BR-31)', () => {
  it.each(CATALOGUE.allergen_vocabulary)('no candidate plate ever carries %s, including "may contain"', (allergen) => {
    for (const mealTime of MEALS) {
      const ctx = ctxOf({ mealTime, budget: 500000, allergy: { ingredients: [], allergens: [allergen], seasoningCubesOk: false } });
      for (const plate of generateCandidates(SNAP, ctx, CFG))
        for (const id of plateComponents(plate))
          for (const line of component.get(id)!.ingredient_lines) {
            const ing = ingredient.get(line.ingredient)!;
            expect([...ing.allergens, ...ing.may_contain], `${id} in ${mealTime}`).not.toContain(allergen);
          }
    }
  });

  it('an allergy to an ingredient excludes every component that uses it, optional or not', () => {
    const ctx = ctxOf({ mealTime: 'dinner', budget: 500000, allergy: { ingredients: ['crayfish'], allergens: [], seasoningCubesOk: false } });
    for (const plate of generateCandidates(SNAP, ctx, CFG))
      for (const id of plateComponents(plate)) expect(component.get(id)!.ingredient_lines.map((l) => l.ingredient)).not.toContain('crayfish');
  });

  it('avoiding crayfish drops it where optional and shows the plate as "Made without crayfish"', () => {
    const ctx = ctxOf({ mealTime: 'dinner', budget: 500000, avoid: { ingredients: ['crayfish'], allergens: [] } });
    const plates = generateCandidates(SNAP, ctx, CFG);
    const withOptional = plates.filter((p) => plateComponents(p).some((id) => component.get(id)!.ingredient_lines.some((l) => l.ingredient === 'crayfish')));
    expect(withOptional.length).toBeGreaterThan(0);
    for (const p of withOptional) {
      expect(p.without).toContain('crayfish');
      for (const id of plateComponents(p)) expect(component.get(id)!.ingredient_lines.filter((l) => l.ingredient === 'crayfish' && !l.optional)).toEqual([]);
    }
  });
});

describe('deck rules', () => {
  it.each(MEALS)('a %s deck has 3 plates, no shared main and at most 2 of one plate type (BR-30)', (mealTime) => {
    const { deck } = deal({ mealTime, budget: 10000 });
    expect(deck.plates).toHaveLength(3);
    expect(new Set(deck.plates.map((p) => p.main)).size).toBe(3);
    for (const p of deck.plates) expect(deck.plates.filter((q) => q.plate.template === p.plate.template).length).toBeLessThanOrEqual(2);
  });

  it('is deterministic for the same request (doc 03, section 5)', () => {
    expect(deal({ seed: 'abc' }).deck.plates.map((p) => p.key)).toEqual(deal({ seed: 'abc' }).deck.plates.map((p) => p.key));
  });

  it('explores on 15% to 25% of decks over 1,000 requests (BR-33)', () => {
    const ctx = ctxOf();
    const scored = scoreAll(SNAP, ctx, fakeCost(SNAP, ctx), CFG);
    let explored = 0;
    for (let i = 0; i < 1000; i++) if (selectDeck(SNAP, scored, { ...ctx, seed: `req-${i}` }, CFG, CFG.DECK_SIZE).explored) explored++;
    expect(explored / 1000).toBeGreaterThanOrEqual(0.15);
    expect(explored / 1000).toBeLessThanOrEqual(0.25);
  });

  it('blocks a main eaten in the last 3 days, but never food cooked and waiting (BR-32, BR-32a)', () => {
    const first = deal().deck.plates[0].main;
    const ateAt = { [first]: '2026-11-18T19:00:00+01:00' };
    expect(deal({ signals: { ...ctxOf().signals, ateAt } }).deck.plates.map((p) => p.main)).not.toContain(first);
    const stewDeck = deal({
      house: { cooked: ['tomato-stew'], foodstuff: [], basic: [] },
      signals: { ...ctxOf().signals, ateAt: { 'tomato-stew': '2026-11-19T19:00:00+01:00' } },
    }).deck;
    expect(stewDeck.plates.some((p) => p.plate.usesCooked)).toBe(true);
  });

  it('puts cooked food from the house on at least 2 cards, first card included (BR-131)', () => {
    const { deck } = deal({ house: { cooked: ['tomato-stew'], foodstuff: [], basic: [] } });
    expect(deck.plates.filter((p) => p.plate.usesCooked).length).toBeGreaterThanOrEqual(2);
    expect(deck.plates[0].plate.usesCooked).toBe(true);
  });

  it('allows at most one stretch plate, within 15% over budget (BR-15)', () => {
    for (const budget of [1100, 1300, 1500, 1800]) {
      const { deck } = deal({ budget });
      if (deck.tight) continue;
      expect(deck.plates.filter((p) => p.stretch).length).toBeLessThanOrEqual(1);
      for (const p of deck.plates) expect(p.cost.outlayHighNgn).toBeLessThanOrEqual(budget * 1.15);
    }
  });

  it('shows the closest plates with their gap when nothing fits (BR-16)', () => {
    const { deck } = deal({ budget: 300 });
    expect(deck.tight).toBe(true);
    expect(deck.plates).toHaveLength(3);
    for (const p of deck.plates) expect(p.gapNgn).toBeGreaterThan(0);
  });

  it('honours a craving for swallow at 23:00 with dinner swallows (A-30)', () => {
    const { deck } = deal({
      mealTime: 'late_night',
      budget: 10000,
      craving: { boostTags: [], avoidTags: [], plateTypes: ['soup_swallow'] },
      filters: { plateTypes: ['soup_swallow'] },
    });
    expect(deck.plates.length).toBeGreaterThan(0);
    expect(deck.plates.every((p) => p.plate.template === 'soup_swallow')).toBe(true);
  });
});

describe('swap and Not this', () => {
  it('a swap changes one slot and pairs at 0.5 or more with every other slot (BR-37)', () => {
    const { ctx, deck } = deal({ mealTime: 'dinner', budget: 10000, filters: { plateTypes: ['soup_swallow'] } });
    const plate = deck.plates[0];
    const swapped = swapSlot(SNAP, ctx, plate, 'swallow', fakeCost(SNAP, ctx), CFG)!;
    expect(swapped).not.toBeNull();
    expect(swapped.plate.slots.swallow).not.toEqual(plate.plate.slots.swallow);
    for (const [k, v] of Object.entries(plate.plate.slots)) if (k !== 'swallow') expect(swapped.plate.slots[k]).toEqual(v);
    for (const id of plateComponents(swapped.plate))
      if (id !== swapped.plate.slots.swallow[0]) expect(pairing(SNAP, swapped.plate.slots.swallow[0], id)).toBeGreaterThanOrEqual(0.5);
  });

  it('Not this never deals a main already on screen, and says so when nothing else fits (BR-39)', () => {
    const { ctx, deck } = deal({ budget: 10000 });
    const next = replaceCard(SNAP, ctx, deck.plates, fakeCost(SNAP, ctx), CFG)!;
    expect(deck.plates.map((p) => p.main)).not.toContain(next.main);
    const tiny = deal({ budget: 10000, mealTime: 'breakfast', filters: { plateTypes: ['snack'], vegetarian: true, spiceMax: 0 } });
    const everyPlate = scoreAll(SNAP, tiny.ctx, fakeCost(SNAP, tiny.ctx), CFG);
    expect(everyPlate.length).toBeGreaterThan(0);
    expect(replaceCard(SNAP, tiny.ctx, everyPlate, fakeCost(SNAP, tiny.ctx), CFG)).toBeNull();
  });
});

describe('taste and personality', () => {
  it('moves affinity toward the signal, decays over 60 days and never passes ±1', () => {
    expect(updateAffinity(0, 0.3, 0)).toBeCloseTo(0.3);
    expect(updateAffinity(0.8, 0, 60)).toBeCloseTo(0.4);
    let a = 0;
    for (let i = 0; i < 50; i++) a = updateAffinity(a, 0.3, 0);
    expect(a).toBeLessThanOrEqual(1);
  });

  it('gives the same personality for the same answers, with fixed tie order (BR-151)', () => {
    const answers = { akara: true, suya: true, 'ewa-agoyin': true };
    expect(personaFor(answers, CFG)).toBe('street');
    expect(personaFor({ 'ewa-agoyin': true, suya: true, akara: true }, CFG)).toBe('street');
    expect(personaFor({ suya: true, 'goat-pepper-soup': true, dodo: true }, CFG)).toBe('pepper');
    expect(personaFor({ suya: true }, CFG)).toBe('connoisseur');
    const everything = Object.fromEntries(
      ['egusi-soup', 'jollof-rice', 'suya', 'amala', 'banga-soup', 'akara', 'goat-pepper-soup', 'dodo', 'ewa-agoyin', 'afang-soup'].map((k) => [k, true]),
    );
    expect(personaFor(everything, CFG)).toBe('everything');
  });
});
