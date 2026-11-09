'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { HISTORY, NO_PLATES, parsePlates, SAVED, store, useStored, type PlateRef } from '@/lib/device/store';

// S-012: Saved and History tabs, from this phone.
export function SavedLists() {
  const t = useTranslations();
  const [tab, setTab] = useState<'saved' | 'history'>('saved');
  const saved = useStored(SAVED, parsePlates, NO_PLATES);
  const history = useStored(HISTORY, parsePlates, NO_PLATES);
  const list = tab === 'saved' ? saved : history;
  const day = (iso: string) => new Intl.DateTimeFormat('en-NG', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));
  const href = (p: PlateRef) => `/plate/${encodeURIComponent(p.key)}?people=${p.people ?? 1}`;
  return (
    <>
      <div role="tablist" className="grid grid-cols-2 gap-2">
        {(['saved', 'history'] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`min-h-12 rounded-pill border-2 border-ink type-label ${tab === k ? 'bg-palm-100' : 'bg-surface'}`}
          >
            {t(`saved.tab.${k}`)}
          </button>
        ))}
      </div>
      <section role="tabpanel" className="grid gap-3">
        {!list.length && <p className="text-ink-2">{t(tab === 'saved' ? 'empty.saved' : 'empty.history')}</p>}
        {list.map((p, i) => (
          <article key={`${p.key}-${p.at}`} className="flex items-center justify-between gap-3 rounded-lg border-2 border-ink bg-surface p-4">
            <div>
              <Link href={href(p)} className="type-title-m underline">
                {p.title}
              </Link>
              <p className="type-caption text-ink-2">{day(p.at)}</p>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              {tab === 'history' && (
                <Link href={href(p)} className="flex min-h-12 items-center justify-center rounded-pill border-2 border-ink bg-palm px-4 type-label">
                  {t('saved.again')}
                </Link>
              )}
              <button
                type="button"
                onClick={() =>
                  store(
                    tab === 'saved' ? SAVED : HISTORY,
                    list.filter((_, j) => j !== i),
                  )
                }
                className="min-h-12 rounded-pill border-2 border-ink bg-surface px-4 type-label"
              >
                {t('saved.remove')}
              </button>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
