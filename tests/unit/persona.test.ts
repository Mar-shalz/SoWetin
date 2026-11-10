import { describe, expect, it } from 'vitest';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { GAME_CARDS, personaFor } from '@/lib/engine/persona';
import { seededRandom, shuffle } from '@/lib/engine/rng';

describe('chop personality game order (Victor, 10 November 2026)', () => {
  it('deals the same 12 cards in a new order, and the order never changes the result (BR-151)', () => {
    const ids = Object.keys(GAME_CARDS);
    const a = shuffle(ids, seededRandom('a'));
    const b = shuffle(ids, seededRandom('b'));
    expect([...a].sort()).toEqual([...ids].sort());
    expect(a).not.toEqual(b);
    const yums = Object.fromEntries(ids.map((id, i) => [id, i % 3 === 0]));
    const inOrder = (order: string[]) => personaFor(Object.fromEntries(order.map((id) => [id, yums[id]])), C);
    expect(inOrder(a)).toBe(inOrder(b));
  });
});

describe('dynamic decks (Victor, 10 November 2026)', () => {
  it('scores any catalogue dish and deals a balanced deck that a link can repeat', async () => {
    const { POOL, parseDeck } = await import('@/lib/play/pool');
    const { dealDeck, personaPoints } = await import('@/lib/engine/persona');
    const deck = dealDeck(POOL, 12, seededRandom('x'));
    expect(new Set(deck).size).toBe(12);
    expect(parseDeck(deck.join('.'))).toEqual(deck);
    expect(parseDeck('egusi-soup.not-a-dish.egusi-soup')).toEqual(['egusi-soup']);
    expect(deck).not.toEqual(dealDeck(POOL, 12, seededRandom('y')));
    const leans = new Set(deck.map((id) => Object.keys(personaPoints(POOL.find((d) => d.id === id)!))[0]));
    expect(leans.size).toBeGreaterThanOrEqual(4);
  });
});
