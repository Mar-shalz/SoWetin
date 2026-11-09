'use client';

import { useTranslations } from 'next-intl';
import { NO_PLATES, parsePlates, SAVED, store, useStored, MAX_ITEMS } from '@/lib/device/store';

// "Save this plate" (S-003, S-004): a toggle kept on this phone until accounts arrive.
export function SaveButton({ plateKey, title, people }: { plateKey: string; title: string; people: number }) {
  const t = useTranslations();
  const saved = useStored(SAVED, parsePlates, NO_PLATES);
  const on = saved.some((p) => p.key === plateKey);
  const toggle = () =>
    store(SAVED, on ? saved.filter((p) => p.key !== plateKey) : [{ key: plateKey, title, people, at: new Date().toISOString() }, ...saved].slice(0, MAX_ITEMS));
  return (
    <button type="button" aria-pressed={on} onClick={toggle} className="min-h-12 rounded-pill border-2 border-ink bg-surface px-4 type-label">
      {on ? t('saved.on') : t('plate.save')}
    </button>
  );
}
