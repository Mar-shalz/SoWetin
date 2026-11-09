import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { DishCard } from '@/components/explore/dish-card';
import { BottomNav } from '@/components/nav/bottom-nav';
import { items, shelf, SHELF_KEYS, type ShelfKey } from '@/lib/catalogue/shelves';
import { catalogueForRequest, lagosToday } from '@/lib/plates/serve';

const SORTS = ['popular', 'quickest', 'cheapest'] as const;

// S-010 Category list: one shelf in full, sorted Popular, Quickest or Cheapest today (doc 02).
export default async function ShelfPage({ params, searchParams }: { params: Promise<{ shelf: string }>; searchParams: Promise<{ sort?: string }> }) {
  const [{ shelf: key }, sp] = await Promise.all([params, searchParams]);
  if (!SHELF_KEYS.includes(key as ShelfKey)) notFound();
  const sort = SORTS.find((s) => s === sp.sort) ?? 'popular';
  const [t, { cat }] = await Promise.all([getTranslations(), catalogueForRequest()]);
  const list = cat ? shelf(items(cat, lagosToday()), key as ShelfKey) : [];
  // Dishes without a price yet go last when sorting by price, never first.
  list.sort((a, b) =>
    sort === 'quickest' ? a.minutes - b.minutes : sort === 'cheapest' ? (a.price1 ?? Infinity) - (b.price1 ?? Infinity) : b.popularity - a.popularity,
  );
  return (
    <main className="mx-auto flex min-h-dvh max-w-app flex-col gap-4 px-4 pt-6">
      <Link href="/explore" className="text-enamel underline">
        {t('detail.back')}
      </Link>
      <h1 className="type-display-l">{t(`explore.shelf.${key as ShelfKey}`)}</h1>
      <nav aria-label={t('explore.sortLabel')} className="flex gap-2">
        {SORTS.map((s) => (
          <Link
            key={s}
            href={`/explore/${key}?sort=${s}`}
            aria-current={s === sort ? 'true' : undefined}
            className={`flex min-h-12 items-center rounded-pill border-2 px-4 type-label ${s === sort ? 'border-ink bg-palm-100' : 'border-ink-3 bg-surface'}`}
          >
            {t(`explore.sort.${s}`)}
          </Link>
        ))}
      </nav>
      {list.length ? (
        <div className="flex flex-wrap gap-3">
          {list.map((i) => (
            <DishCard key={i.id} item={i} minutes={t('plate.why.time', { minutes: i.minutes })} />
          ))}
        </div>
      ) : (
        <p className="text-ink-2">{t('explore.empty')}</p>
      )}
      <div className="mt-auto" />
      <BottomNav current="explore" />
    </main>
  );
}
