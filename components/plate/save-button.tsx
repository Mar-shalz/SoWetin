'use client';

import { useTranslations } from 'next-intl';
import { HeartIcon } from '@/components/ui/icons';
import { NO_PLATES, parsePlates, SAVED, store, useStored, MAX_ITEMS } from '@/lib/device/store';

// "Save this plate" (S-003, S-004): a toggle kept on this phone until accounts arrive.
// icon: a heart in a white circle, for sitting on a plate picture.
export function SaveButton({ plateKey, title, people, icon }: { plateKey: string; title: string; people: number; icon?: boolean }) {
  const t = useTranslations();
  const saved = useStored(SAVED, parsePlates, NO_PLATES);
  const on = saved.some((p) => p.key === plateKey);
  const toggle = () =>
    store(SAVED, on ? saved.filter((p) => p.key !== plateKey) : [{ key: plateKey, title, people, at: new Date().toISOString() }, ...saved].slice(0, MAX_ITEMS));
  if (icon)
    return (
      <button
        type="button"
        aria-pressed={on}
        aria-label={t('plate.save')}
        onClick={toggle}
        className={`sw-heart grid size-12 place-items-center rounded-pill border-2 border-ink bg-surface shadow-button ${on ? 'text-palm [&_path]:fill-current' : 'text-ink'}`}
      >
        <HeartIcon size={22} />
      </button>
    );
  return (
    <button type="button" aria-pressed={on} onClick={toggle} className="sw-heart min-h-12 rounded-pill border-2 border-ink bg-surface px-3.5 type-label">
      {on ? t('saved.on') : t('plate.save')}
    </button>
  );
}
