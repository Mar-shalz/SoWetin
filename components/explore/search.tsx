'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { DishCard } from '@/components/explore/dish-card';
import type { Item } from '@/lib/catalogue/shelves';

const MAX_RESULTS = 30;
// Search ignores case and accents, so "ofe owerri" finds "Ọ̀fẹ̀ Owerri" (doc 02: aliases, local names, misspellings).
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function ExploreSearch({ items }: { items: Item[] }) {
  const t = useTranslations();
  const [q, setQ] = useState('');
  const query = fold(q.trim());
  const hits = query ? items.filter((i) => [i.name, i.localName ?? '', ...i.aliases].some((s) => fold(s).includes(query))).slice(0, MAX_RESULTS) : [];
  return (
    <div className="grid gap-3">
      <label className="grid gap-1">
        <span className="sr-only">{t('explore.search')}</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('explore.search')}
          className="min-h-14 rounded-pill border-2 border-ink bg-surface px-4 type-input"
        />
      </label>
      {query && (
        <div aria-live="polite" className="flex flex-wrap gap-3">
          {hits.length ? (
            hits.map((i) => <DishCard key={i.id} item={i} minutes={t('plate.why.time', { minutes: i.minutes })} />)
          ) : (
            <p className="text-ink-2">{t('explore.noResults')}</p>
          )}
        </div>
      )}
    </div>
  );
}
