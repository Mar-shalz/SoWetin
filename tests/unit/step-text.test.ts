import { describe, expect, it } from 'vitest';
import { stepText } from '@/lib/plates/step-text';

describe('live amounts inside steps (doc 07, S-005)', () => {
  it('fills tokens for the servings shown and drops unknown ones', () => {
    const amount = (id: string) => (id === 'egusi-ground' ? '400 g Ground egusi' : null);
    expect(stepText('Stir in {ing:egusi-ground} slowly.', amount)).toBe('Stir in 400 g Ground egusi slowly.');
    expect(stepText('Add {ing:unknown} now.', amount)).toBe('Add now.');
    expect(stepText('No tokens here.', amount)).toBe('No tokens here.');
  });
});
