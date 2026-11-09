'use client';

import { useMemo, useSyncExternalStore } from 'react';

// Small lists kept on this phone until accounts arrive (saved plates, Ate it history). Every read is validated,
// and the server render always sees an empty list, so pages hydrate the same way on every phone.
const listeners = new Set<() => void>();
const read = (key: string) => {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
};

export function useStored<T>(key: string, parse: (raw: unknown) => T, empty: T): T {
  const raw = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      window.addEventListener('storage', cb);
      return () => {
        listeners.delete(cb);
        window.removeEventListener('storage', cb);
      };
    },
    () => read(key),
    () => '',
  );
  return useMemo(() => {
    try {
      return raw ? parse(JSON.parse(raw)) : empty;
    } catch {
      return empty;
    }
  }, [raw, parse, empty]);
}

export function store(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing: the list lasts until the page closes.
  }
  listeners.forEach((l) => l());
}

// Saved plates (S-012) and the Ate it log: plate keys with a title and a date. Keys follow the engine's format.
export type PlateRef = { key: string; title: string; at: string; people?: number };
export const SAVED = 'sw_saved';
export const HISTORY = 'sw_history';
export const MAX_ITEMS = 100;
export const NO_PLATES: PlateRef[] = [];
export const parsePlates = (raw: unknown): PlateRef[] =>
  (Array.isArray(raw) ? raw : [])
    .filter(
      (p): p is PlateRef =>
        !!p && typeof p.key === 'string' && p.key.length <= 400 && typeof p.title === 'string' && p.title.length <= 200 && typeof p.at === 'string',
    )
    .slice(0, MAX_ITEMS);
