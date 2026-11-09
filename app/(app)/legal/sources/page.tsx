import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { APP_CONFIG as C } from '@/lib/config/app.config';

const SECTIONS = [
  ['prices', 'howWePrice.body'],
  ['recipes', 'recipes.note.full'],
  ['videos', 'videos.note.full'],
  ['ai', 'ai.note.full'],
  ['allergies', 'allergy.note.full'],
  ['partners', 'partner.note.full'],
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal.sources');
  return { title: t('title'), alternates: { canonical: '/legal/sources' } };
}

// S-021 "Where this comes from": one section per kind of content, each the fixed full note from doc 11, section 6,
// with an anchor every trust line can link to (/legal/sources#prices and so on).
export default async function SourcesPage() {
  const t = await getTranslations();
  const updated = new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(C.SOURCES_PAGE_UPDATED));
  return (
    <main className="mx-auto flex min-h-dvh max-w-app flex-col gap-6 px-4 py-6">
      <Link href="/" className="text-enamel underline">
        {t('detail.back')}
      </Link>
      <h1 className="type-display-l">{t('legal.sources.title')}</h1>
      <p className="type-body-l">{t('legal.sources.intro')}</p>
      {SECTIONS.map(([id, key]) => (
        <section key={id} id={id} aria-labelledby={`${id}-title`} className="scroll-mt-4">
          <h2 id={`${id}-title`} className="type-title-l">
            {t(`legal.sources.${id}`)}
          </h2>
          <p className="mt-2">{t(key)}</p>
          {id === 'prices' && <p className="mt-2">{t('prices.disclaimer.full')}</p>}
        </section>
      ))}
      <p className="type-caption text-ink-2">{t('legal.updated', { date: updated })}</p>
    </main>
  );
}
