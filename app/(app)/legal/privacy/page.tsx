import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { APP_CONFIG as C } from '@/lib/config/app.config';

const SECTIONS = ['short', 'phone', 'servers', 'ai', 'videos', 'cookies', 'helpers', 'rights', 'changes'] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: 'en-NG' });
  return { title: t('legal.privacy.title') };
}

// Privacy notice (doc 13): what the app does with data today, in plain English. English is the binding text; in Pidgin
// a short Pidgin summary comes first. It describes the app as built: no accounts, nothing about users kept on our side.
// shortcut: written for counsel to review (Q-08) before it's final; update it whenever accounts or analytics arrive.
export default async function PrivacyPage() {
  const [en, t, locale] = await Promise.all([getTranslations({ locale: 'en-NG' }), getTranslations(), getLocale()]);
  const updated = new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(C.PRIVACY_UPDATED));
  return (
    <main className="mx-auto flex min-h-dvh max-w-app flex-col gap-5 px-4 py-6">
      <Link href="/me" className="text-enamel underline">
        {t('detail.back')}
      </Link>
      <h1 className="type-display-l">{en('legal.privacy.title')}</h1>
      <p className="type-caption text-ink-2">{en('legal.updated', { date: updated })}</p>
      {locale === 'pcm' && <p className="rounded-md bg-sunken p-3">{t('legal.privacy.summary')}</p>}
      {SECTIONS.map((s) => (
        <section key={s} aria-labelledby={`privacy-${s}`} className="grid gap-2">
          <h2 id={`privacy-${s}`} className="type-title-m">
            {en(`legal.privacy.${s}.title`)}
          </h2>
          <p>{en(`legal.privacy.${s}.body`)}</p>
          {s === 'rights' && C.PRIVACY_CONTACT_EMAIL && <p>{en('legal.privacy.contact', { email: C.PRIVACY_CONTACT_EMAIL })}</p>}
        </section>
      ))}
      <Link href="/legal/sources" className="text-enamel underline">
        {t('legal.sources.title')}
      </Link>
    </main>
  );
}
