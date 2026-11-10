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
