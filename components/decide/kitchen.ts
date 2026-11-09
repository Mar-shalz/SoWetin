'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { APP_CONFIG as C } from '@/lib/config/app.config';

// What's in the house (S-024), kept on this phone until accounts arrive (doc 07 sends it with every cook request).
// Cooked food counts for HOUSE_COOKED_DAYS, then drops off by itself.
export type Kitchen = { cooked: { id: string; at: string }[]; foodstuff: string[]; basic: string[] };
export const EMPTY_KITCHEN: Kitchen = { cooked: [], foodstuff: [], basic: [] };
const KEY = 'sw_kitchen';
const SLUG = /^[a-z0-9-]{1,80}$/; // the same rule the API applies, so a stored list can never get a request refused
const listeners = new Set<() => void>();

export const lagosToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: C.TIMEZONE }).format(new Date());
const read = () => {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
};
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener('storage', cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', cb);
  };
};

export function parseKitchen(raw: string, today: string): Kitchen {
  try {
    const k = JSON.parse(raw) as Partial<Kitchen>;
    const ids = (a: unknown) => (Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string' && SLUG.test(x)) : []);
    const fresh = (at: string) => (Date.parse(today) - Date.parse(at)) / 86_400_000 < C.HOUSE_COOKED_DAYS;
    return {
      cooked: (Array.isArray(k.cooked) ? k.cooked : []).filter(
        (c): c is { id: string; at: string } =>
          !!c && typeof c.id === 'string' && SLUG.test(c.id) && typeof c.at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.at) && fresh(c.at),
      ),
      foodstuff: ids(k.foodstuff),
      basic: ids(k.basic),
    };
  } catch {
    return EMPTY_KITCHEN;
  }
}

export function saveKitchen(k: Kitchen) {
  try {
    localStorage.setItem(KEY, JSON.stringify(k));
  } catch {
    // Private browsing: the list lasts until the page closes.
  }
  listeners.forEach((l) => l());
}

// The server render always sees an empty kitchen, so the page hydrates the same way on every phone.
export function useKitchen(): Kitchen {
  const raw = useSyncExternalStore(subscribe, read, () => '');
  return useMemo(() => (raw ? parseKitchen(raw, lagosToday()) : EMPTY_KITCHEN), [raw]);
}

export const kitchenForApi = (k: Kitchen) => ({ cooked: k.cooked.map((c) => c.id), foodstuff: k.foodstuff, basic: k.basic });
