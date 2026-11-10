import { describe, expect, it } from 'vitest';
import { motionTier } from '@/lib/motion/tier';

describe('motion tiers (doc 10, section 2)', () => {
  it('lets the person choose, then follows the phone', () => {
    expect(motionTier('full', { reduced: true })).toBe('full');
    expect(motionTier('auto', { reduced: true, memoryGb: 8 })).toBe('reduced');
    expect(motionTier('auto', { reduced: false, memoryGb: 2 })).toBe('lite');
    expect(motionTier('auto', { reduced: false, cores: 4 })).toBe('lite');
    expect(motionTier('auto', { reduced: false, saveData: true })).toBe('lite');
    expect(motionTier('auto', { reduced: false, memoryGb: 8, cores: 8 })).toBe('full');
  });
});
