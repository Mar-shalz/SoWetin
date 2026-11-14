import { getTranslations } from 'next-intl/server';
import { Decide } from '@/components/decide/decide';
import { BottomNav } from '@/components/nav/bottom-nav';
import { PersonalityCard } from '@/components/play/personality-card';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { mealTimeAt } from '@/lib/engine/time';
import { pictureUrl } from '@/lib/db/env';
import { catalogueForRequest } from '@/lib/plates/serve';

// S-001 Decide: the sentence, the house row, the craving field, Pick for me and the plate cards live in <Decide>.
export default async function DecidePage() {
  const t = await getTranslations();
  const greeting = t(`home.greeting.${mealTimeAt(new Date(), C.MEAL_WINDOWS, C.TIMEZONE)}`);
  const cut = greeting.search(/[.?!]\s/);
  const { cat } = await catalogueForRequest();
  return (
    <main className="mx-auto flex min-h-dvh max-w-app flex-col px-4 pt-4">

      <Decide
        house={cat?.house ?? { cooked: [], foodstuff: [], basic: [] }}
        promo={C.TASTE_GAME_ENABLED && <PersonalityCard />}
        reelItems={cat ? [...cat.display.values()].slice(0, C.REEL_NAMES_MAX).map((d) => ({ name: d.name, picture: pictureUrl(d.picture) })) : []}
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

