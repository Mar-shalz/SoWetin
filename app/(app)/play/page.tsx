import { getTranslations } from 'next-intl/server';
import { body, display } from '@/app/fonts/fonts';
import { BottomNav } from '@/components/nav/bottom-nav';
import { Game } from '@/components/play/game';
import { GAME_CARDS } from '@/lib/engine/persona';
import { catalogueForRequest } from '@/lib/plates/serve';
import { shuffle } from '@/lib/engine/rng';

// F29 Chop Personality (S-018 then S-028). The 12 game cards are fixed catalogue dishes (doc 03, section 6.4), dealt in a
// new order every visit; the order never changes the result (BR-151).
export default async function PlayPage() {
  const [t, { cat }] = await Promise.all([getTranslations('persona'), catalogueForRequest()]);
  const title = (id: string) => id.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
  const cards = shuffle(Object.keys(GAME_CARDS), Math.random).map((id) => ({ id, name: cat?.display.get(id)?.name ?? title(id), picture: cat?.display.get(id)?.picture ?? null }));
  return (
    <main className="mx-auto flex min-h-dvh max-w-app flex-col gap-4 px-4 pt-6">
      <div>
        <h1 className="type-title-l">{t('entry.title')}</h1>
        <p className="text-ink-2">{t('entry.body')}</p>
      </div>
      <Game cards={cards} fonts={{ display: display.style.fontFamily, body: body.style.fontFamily }} />
      <div className="mt-auto" />
      <BottomNav current="me" />
    </main>
  );
}
