'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useSyncExternalStore } from 'react';
import { motionTier, type MotionPref, type Tier } from '@/lib/motion/tier';

const KEY = 'sw_motion';
const PREFS: MotionPref[] = ['auto', 'full', 'lite', 'reduced'];
const listeners = new Set<() => void>();
const readPref = (): MotionPref => {
  try {
    const v = localStorage.getItem(KEY);
    return PREFS.includes(v as MotionPref) ? (v as MotionPref) : 'auto';
  } catch {
    return 'auto';
  }
};
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const device = () => {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return { reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, memoryGb: nav.deviceMemory, cores: nav.hardwareConcurrency, saveData: nav.connection?.saveData };
};
const tierNow = (): Tier => motionTier(readPref(), device());

// Puts the tier on <html data-motion> for the CSS in globals.css (doc 10, section 2). Renders nothing.
export function MotionTier() {
  const pref = useSyncExternalStore(subscribe, readPref, () => 'auto' as MotionPref);
  useEffect(() => {
    document.documentElement.dataset.motion = tierNow();
  }, [pref]);
  return null;
}

// Me > Motion (S-014): "Auto (Full)" and the three tiers, kept on this phone.
export function MotionSetting() {
  const t = useTranslations('settings.motion');
  const pref = useSyncExternalStore(subscribe, readPref, () => 'auto' as MotionPref);
  const auto = useSyncExternalStore(subscribe, () => motionTier('auto', device()), () => 'full' as Tier);
  const choose = (p: MotionPref) => {
    try {
      localStorage.setItem(KEY, p);
    } catch {
      // Storage blocked: the choice can't be kept, and Auto stays on.
    }
    listeners.forEach((l) => l()); // MotionTier re-renders and sets the new tier
  };
  return (
    <fieldset>
      <legend className="type-label">{t('_')}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {PREFS.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={pref === p}
            onClick={() => choose(p)}
            className={`min-h-12 rounded-pill border-2 px-4 type-label ${pref === p ? 'border-ink bg-palm-100' : 'border-ink-3 bg-surface'}`}
          >
            {p === 'auto' ? t('auto', { tier: t(auto) }) : t(p)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
