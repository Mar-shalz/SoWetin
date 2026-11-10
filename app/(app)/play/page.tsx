import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { body, display } from '@/app/fonts/fonts';
import { BottomNav } from '@/components/nav/bottom-nav';
import { Game } from '@/components/play/game';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { pictureUrl } from '@/lib/db/env';
import { dealDeck, personaPoints } from '@/lib/engine/persona';
import { POOL, POOL_BY_ID, parseDeck } from '@/lib/play/pool';
import { catalogueForRequest } from '@/lib/plates/serve';

// F29 Chop Personality (S-018 then S-028). Every new game deals a fresh, balanced 12 from the whole catalogue, and the
// deck rides in the link (?d=...), so a friend who opens a shared game gets the same plates and their own result.
export default async function PlayPage({ searchParams }: { searchParams: Promise<{ d?: string; f?: string }> }) {
  const [{ d, f }, t, { cat }] = await Promise.all([searchParams, getTranslations('persona'), catalogueForRequest()]);
  const deck = parseDeck(d).slice(0, C.TASTE_GAME_CARDS);
  if (deck.length < C.TASTE_GAME_MIN_ANSWERS) redirect(`/play?d=${dealDeck(POOL, C.TASTE_GAME_CARDS, Math.random).join('.')}`);
  const cards = deck.map((id) => ({ id, name: cat?.display.get(id)?.name ?? POOL_BY_ID.get(id)!.name, picture: pictureUrl(cat?.display.get(id)?.picture ?? null) }));
  const points = Object.fromEntries(deck.map((id) => [id, personaPoints(POOL_BY_ID.get(id)!)]));
  return (
    <main className="mx-auto flex min-h-dvh max-w-app flex-col gap-4 px-4 pt-6">
      <div>
        <h1 className="type-title-l">{t('entry.title')}</h1>
        <p className="text-ink-2">{f ? t('friend') : t('entry.body')}</p>
      </div>
      <Game cards={cards} points={points} fonts={{ display: display.style.fontFamily, body: body.style.fontFamily }} />
      <div className="mt-auto" />
      <BottomNav current="me" />
    </main>
  );
}
