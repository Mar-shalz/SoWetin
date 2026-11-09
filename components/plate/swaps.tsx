'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useSyncExternalStore } from 'react';

// S-019: a substitution the person taps changes the recipe on this phone, for this visit only (sessionStorage).
// Shape: component id → the ingredient it replaces → what goes in instead.
// shortcut: the price and the market list stay on the written recipe; costing a swap needs the price book on the phone.
export type Swap = { with: string; withName: string };
type Swaps = Record<string, Record<string, Swap>>;
const KEY = 'sw_swaps';
const listeners = new Set<() => void>();
const read = () => {
  try {
    return sessionStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
};
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const SLUG = /^[a-z0-9-]{1,80}$/;

// Checked on every read, so a stored value can only ever be shown as plain text for a known shape.
export function parseSwaps(raw: string): Swaps {
  try {
    const out: Swaps = {};
    for (const [c, m] of Object.entries(JSON.parse(raw) as Record<string, Record<string, Swap>>)) {
      if (!SLUG.test(c) || !m || typeof m !== 'object') continue;
      for (const [i, s] of Object.entries(m))
        if (SLUG.test(i) && s && SLUG.test(s.with) && typeof s.withName === 'string') (out[c] ??= {})[i] = { with: s.with, withName: s.withName.slice(0, 80) };
    }
    return out;
  } catch {
    return {};
  }
}

export function useSwaps(): Swaps {
  const raw = useSyncExternalStore(subscribe, read, () => '');
  return useMemo(() => (raw ? parseSwaps(raw) : {}), [raw]);
}

export function setSwap(component: string, replace: string, swap: Swap | null) {
  const all = parseSwaps(read());
  const mine = { ...all[component] };
  if (swap) mine[replace] = swap;
  else delete mine[replace];
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...all, [component]: mine }));
  } catch {
    // Storage blocked: the swap simply doesn't stick.
  }
  listeners.forEach((l) => l());
}

export function IngredientName({ component, id, name }: { component: string; id: string; name: string }) {
  const t = useTranslations('chef.swap');
  const s = useSwaps()[component]?.[id];
  return <>{s ? t('line', { with: s.withName, replace: name }) : name}</>;
}
