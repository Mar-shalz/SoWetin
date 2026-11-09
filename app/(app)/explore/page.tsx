import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { DishCard } from '@/components/explore/dish-card';
import { ExploreSearch } from '@/components/explore/search';
import { BottomNav } from '@/components/nav/bottom-nav';
import { items, plain, shelf, SHELF_KEYS } from '@/lib/catalogue/shelves';
import { catalogueForRequest, lagosToday } from '@/lib/plates/serve';

const SHELF_PREVIEW = 10;

// S-009 Explore: search over names, local names and misspellings, then the shelves of doc 05, section 2.2.
export default async function ExplorePage() {
  const [t, { cat }] = await Promise.all([getTranslations(), catalogueForRequest()]);
  const all = cat ? items(cat, lagosToday()) : [];
  const shelves = SHELF_KEYS.map((k) => [k, shelf(all, k)] as const).filter(([, list]) => list.length);
  return (
    <main className="mx-auto flex min-h-dvh max-w-app flex-col gap-6 px-4 pt-6">
      <h1 className="type-display-l">{t('nav.explore')}</h1>
      <ExploreSearch items={plain(all)} />
      {!shelves.length && <p className="text-ink-2">{t('explore.empty')}</p>}
      {shelves.map(([key, list]) => (
        <section key={key} aria-labelledby={`shelf-${key}`}>
          <div className="flex items-center justify-between">
            <h2 id={`shelf-${key}`} className="type-title-m">
              {t(`explore.shelf.${key}`)}
            </h2>
            <Link href={`/explore/${key}`} className="flex min-h-12 items-center type-label underline">
              {t('explore.seeAll')}
            </Link>
          </div>
          <div className="-mx-4 mt-2 flex gap-3 overflow-x-auto px-4 pb-2">
            {[...list]
              .sort((a, b) => b.popularity - a.popularity)
              .slice(0, SHELF_PREVIEW)
              .map((i) => (
                <DishCard key={i.id} item={i} minutes={t('plate.why.time', { minutes: i.minutes })} />
              ))}
          </div>
        </section>
      ))}
      <div className="mt-auto" />
      <BottomNav current="explore" />
    </main>
  );
}
