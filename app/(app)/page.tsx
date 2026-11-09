import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { CaretIcon, ChevronIcon, HouseIcon, SearchIcon, SlidersIcon } from '@/components/ui/icons';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { catalogueHealth } from '@/lib/db/health';
import { mealTimeAt } from '@/lib/engine/time';
import { formatNaira } from '@/lib/i18n/money';

// S-001 Decide, M0 shell: real tokens, fonts and copy keys, nothing interactive yet (the controls come in M2, doc 15).
export default async function DecidePage() {
  const t = await getTranslations();
  const greeting = t(`home.greeting.${mealTimeAt(new Date(), C.MEAL_WINDOWS, C.TIMEZONE)}`);
  const cut = greeting.search(/[.?!]\s/);
  const answers: Record<string, string> = {
    budget: formatNaira(C.FIRST_VISIT_DEFAULT_BUDGET),
    people: t('home.sentence.people', { count: C.PEOPLE_DEFAULT }),
    mode: t('home.sentence.cook'),
  };
  // Odd entries are placeholder names: "I have {budget} for {people}..." becomes words and answer pills.
  // Punctuation right after a pill stays glued to it, so a line never starts with a comma.
  const sentence = (t.raw('home.sentence._') as string).split(/\{(\w+)\}/);
  const glued = (i: number) => (i % 2 ? (sentence[i + 1]?.match(/^[,.!?]/)?.[0] ?? '') : '');

  return (
    <main className="mx-auto flex min-h-dvh max-w-app flex-col px-4 pb-6">
      <p className="-mx-4 bg-ink px-4 py-2 type-caption text-cream">
        {t('preview.m0')}
        {/* Streams in after the page, so a slow database never delays the first paint. */}
        <Suspense fallback={null}>
          <DatabaseStatus />
        </Suspense>
      </p>

      <header className="flex min-h-14 items-center justify-between gap-2">
        <span className="type-title-l">{C.APP_NAME}</span>
        <div className="flex items-center gap-2">
          <span className="inline-flex min-h-10 items-center gap-1 rounded-pill border-2 border-ink bg-surface px-3 type-label">
            <SlidersIcon size={18} />
            <span className="max-sm:sr-only">{t('home.cta.filters')}</span>
          </span>
          <span className="inline-flex min-h-10 items-center gap-1 rounded-pill border-2 border-ink bg-surface px-3 type-label">
            {t('areas.lagos')}
            <CaretIcon size={16} />
          </span>
        </div>
      </header>

      <h1 className="mt-2">
        {cut > 0 && <span className="block type-body-l text-ink-2">{greeting.slice(0, cut + 1)}</span>}
        <span className="block type-display-xl">{greeting.slice(cut + 1).trim()}</span>
      </h1>

      <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-3 type-title-l">
        {sentence.map((part, i) => {
          if (i % 2)
            return (
              <span key={i} className="inline-flex items-center">
                <span className="inline-flex min-h-12 items-center gap-1 rounded-pill border-2 border-ink bg-palm-100 px-3 shadow-button">
                  {answers[part]}
                  <CaretIcon size={20} />
                </span>
                {glued(i)}
              </span>
            );
          const words = (glued(i - 1) ? part.slice(1) : part).trim();
          return words && <span key={i}>{words}</span>;
        })}
      </p>
      <p className="mt-3 type-caption text-ink-2">{t('home.sentence.hint')}</p>

      <div className="mt-6 flex min-h-14 items-center gap-3 rounded-lg border-2 border-ink bg-surface px-4 type-label">
        <HouseIcon />
        <span className="flex-1">{t('home.house.empty')}</span>
        <ChevronIcon />
      </div>

      <div className="mt-3 flex min-h-14 items-center gap-2 rounded-pill border-2 border-ink bg-surface pl-4 pr-2">
        <SearchIcon size={20} />
        <span className="min-w-0 flex-1 truncate type-input text-ink-3">{t('home.craving.placeholder')}</span>
        <span className="rounded-pill border-2 border-ink-3 bg-sunken px-4 py-2 type-label text-ink-3">{t('craving.find')}</span>
      </div>

      <div className="mt-auto pt-8">
        <span className="flex min-h-14 items-center justify-center rounded-pill border-2 border-ink bg-palm shadow-button type-title-m">
          {t('home.cta.pick')}
        </span>
        <p className="mt-3 text-center type-label underline underline-offset-4">{t('home.cta.show3Instead')}</p>
      </div>
    </main>
  );
}

async function DatabaseStatus() {
  const [health, t] = await Promise.all([catalogueHealth(), getTranslations('preview')]);
  return health && <span className="block">{t('db', { ingredients: health.ingredients, published: health.published })}</span>;
}
