import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { BottomNav } from '@/components/nav/bottom-nav';

// S-013 Me, before accounts: what lives on this phone, and the pages people look for.
// shortcut: no sign-in, language switch, allergies or data export until accounts and consent arrive (M3).
export default async function MePage() {
  const t = await getTranslations();
  const links = [
    ['/play', t('persona.entry.title')],
    ['/saved', t('nav.saved')],
    ['/legal/sources', t('legal.sources.title')],
  ] as const;
  return (
    <main className="mx-auto flex min-h-dvh max-w-app flex-col gap-4 px-4 pt-6">
      <h1 className="type-display-l">{t('nav.me')}</h1>
      <p className="text-ink-2">{t('me.onPhone')}</p>
      <ul className="grid gap-3">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="flex min-h-14 items-center rounded-lg border-2 border-ink bg-surface px-4 type-label">
              {label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-auto" />
      <BottomNav current="me" />
    </main>
  );
}
