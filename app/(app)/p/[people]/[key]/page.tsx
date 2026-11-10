import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { formatNaira } from '@/lib/i18n/money';
import { catalogueForRequest } from '@/lib/plates/serve';
import { shareCard, shortDate } from '@/lib/share/card';

type Params = { params: Promise<{ people: string; key: string }> };
const load = async ({ params }: Params) => {
  const [{ people, key }, { cat }] = await Promise.all([params, catalogueForRequest()]);
  return cat ? shareCard(cat, key, people) : null;
};

// Shared links aren't for search engines: every plate and people count would be its own page.
export async function generateMetadata(p: Params): Promise<Metadata> {
  const card = await load(p);
  return card ? { title: card.title, robots: { index: false, follow: true } } : {};
}

// S-022 Shared plate page: the plate card, today's estimate with its label and note, then Cook this or Pick for me.
// Plain links and server HTML, so it works without JavaScript.
// shortcut: the link carries the plate and people itself; short ids (the shares table) need anonymous profiles first.
export default async function SharedPlatePage(p: Params) {
  const [card, t] = await Promise.all([load(p), getTranslations()]);
  if (!card) notFound();
  const people = t('home.sentence.people', { count: card.people });
  return (
    <main className="mx-auto flex min-h-dvh max-w-app flex-col gap-5 px-4 py-6">
      <article className="rounded-lg border-2 border-ink bg-surface p-4">
        {card.picture && (
          <Image src={card.picture} alt={card.title} width={640} height={480} priority sizes="(max-width: 480px) 100vw, 480px" className="mb-3 aspect-[4/3] w-full rounded-md object-cover" />
        )}
        <h1 className="type-display-l">{card.title}</h1>
        {card.price && (
          <>
            <p className="mt-3 type-price-l">
              {t('share.card.price', { low: formatNaira(card.price.low), high: formatNaira(card.price.high), people, area: t('areas.lagos') })}
            </p>
            <p className="type-caption text-ink-2">{t('share.card.estimate', { date: shortDate(card.price.date) })}</p>
            <p className="mt-2 type-caption text-ink-2">{t('prices.note.line')}</p>
          </>
        )}
      </article>
      <Link
        href={`/plate/${encodeURIComponent(card.key)}?people=${card.people}`}
        className="flex min-h-14 items-center justify-center rounded-pill border-2 border-ink bg-palm type-title-m"
      >
        {t('share.page.cook')}
      </Link>
      <Link href="/" className="flex min-h-12 items-center justify-center rounded-pill border-2 border-ink bg-surface type-label">
        {t('share.page.pick')}
      </Link>
    </main>
  );
}
