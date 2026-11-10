import { describe, expect, it } from 'vitest';
import type { Catalogue } from '@/lib/catalogue/db';
import { sharePath, shareCard } from '@/lib/share/card';
import { SNAP } from '../fixtures/engine';

describe('shared plates (S-017, S-022)', () => {
  const cat = { snap: SNAP, display: new Map(), names: new Map(), book: { ingredients: {}, prices: {} } } as unknown as Catalogue;

  it('refuses people counts outside the app range and keys that name no plate', () => {
    expect(shareCard(cat, encodeURIComponent('soup_swallow:soup=egusi-soup'), '0')).toBeNull();
    expect(shareCard(cat, encodeURIComponent('soup_swallow:soup=egusi-soup'), '2.5')).toBeNull();
    expect(shareCard(cat, 'nothing-here', '2')).toBeNull();
  });

  it('puts the people count and the whole plate key in the link', () => {
    expect(sharePath('soup_swallow:soup=egusi-soup,swallow=eba', 2)).toBe('/p/2/soup_swallow%3Asoup%3Degusi-soup%2Cswallow%3Deba');
  });
});
