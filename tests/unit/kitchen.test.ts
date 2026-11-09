import { describe, expect, it } from 'vitest';
import { kitchenForApi, parseKitchen } from '@/components/decide/kitchen';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { contextFor, Scene } from '@/lib/plates/request';
import type { Catalogue } from '@/lib/catalogue/db';
import { SNAP } from '../fixtures/engine';

describe("what's in the house (S-024), kept on the phone", () => {
  it(`keeps cooked food for ${C.HOUSE_COOKED_DAYS} days and drops anything malformed`, () => {
    const raw = JSON.stringify({
      cooked: [
        { id: 'egusi-soup', at: '2026-11-09' },
        { id: 'tomato-stew', at: '2026-11-01' },
        { id: 'not ok!', at: '2026-11-09' },
      ],
      foodstuff: ['rice-local-parboiled', 42, '<script>'],
      basic: 'nope',
    });
    expect(parseKitchen(raw, '2026-11-10')).toEqual({ cooked: [{ id: 'egusi-soup', at: '2026-11-09' }], foodstuff: ['rice-local-parboiled'], basic: [] });
    expect(parseKitchen('{broken', '2026-11-10')).toEqual({ cooked: [], foodstuff: [], basic: [] });
  });

  it('reaches the engine in cook mode only', () => {
    const cat = { snap: SNAP } as Catalogue;
    const house = kitchenForApi({ cooked: [{ id: 'egusi-soup', at: '2026-11-10' }], foodstuff: ['eggs'], basic: [] });
    const scene = (mode: 'cook' | 'buy') => Scene.parse({ budget_ngn: 3500, people: 1, mode, house });
    expect(contextFor(scene('cook'), cat, 's').house).toEqual({ cooked: ['egusi-soup'], foodstuff: ['eggs'], basic: [] });
    expect(contextFor(scene('buy'), cat, 's').house).toEqual({ cooked: [], foodstuff: [], basic: [] });
    expect(Scene.safeParse({ budget_ngn: 3500, people: 1, mode: 'cook', house: { cooked: ['<b>'], foodstuff: [], basic: [] } }).success).toBe(false);
  });
});
