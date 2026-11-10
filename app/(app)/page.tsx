import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { Decide } from '@/components/decide/decide';
import { BottomNav } from '@/components/nav/bottom-nav';
import { PersonalityCard } from '@/components/play/personality-card';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { catalogueHealth } from '@/lib/db/health';
import { mealTimeAt } from '@/lib/engine/time';
import { catalogueForRequest } from '@/lib/plates/serve';

// S-001 Decide: the sentence, the house row, the craving field, Pick for me and the plate cards live in <Decide>.
export default async function DecidePage() {
  const t = await getTranslations();
  const greeting = t(`home.greeting.${mealTimeAt(new Date(), C.MEAL_WINDOWS, C.TIMEZONE)}`);
  const cut = greeting.search(/[.?!]\s/);
  const { cat } = await catalogueForRequest();
  return (
    <main className="mx-auto flex min-h-dvh max-w-app flex-col px-4">
      <p className="-mx-4 bg-ink px-4 py-2 type-caption text-cream">
        {t('preview.m0')}
        {/* Streams in after the page, so a slow database never delays the first paint. */}
        <Suspense fallback={null}>
          <DatabaseStatus />
        </Suspense>
      </p>

      <Decide
        house={cat?.house ?? { cooked: [], foodstuff: [], basic: [] }}
        promo={C.TASTE_GAME_ENABLED && <PersonalityCard />}
        reelNames={cat ? [...cat.display.values()].map((d) => d.name).slice(0, C.REEL_NAMES_MAX) : []}
        greeting={
          <h1 className="mt-2">
            {cut > 0 && <span className="block type-body-l text-ink-2">{greeting.slice(0, cut + 1)}</span>}
            <span className="block type-display-xl">{greeting.slice(cut + 1).trim()}</span>
          </h1>
        }
      />
      <BottomNav current="decide" />
    </main>
  );
}

async function DatabaseStatus() {
  const [health, t] = await Promise.all([catalogueHealth(), getTranslations('preview')]);
  return health && <span className="block">{t('db', { ingredients: health.ingredients, published: health.published })}</span>;
}
