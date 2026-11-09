import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

// The bottom bar (doc 02): Decide, Explore, Saved, Me. Cook mode and sheets don't show it.
const TABS = [
  ['/', 'decide'],
  ['/explore', 'explore'],
  ['/saved', 'saved'],
  ['/me', 'me'],
] as const;

export async function BottomNav({ current }: { current: (typeof TABS)[number][1] }) {
  const t = await getTranslations('nav');
  return (
    <nav aria-label={t('label')} className="sticky bottom-0 z-10 -mx-4 mt-6 grid grid-cols-4 border-t-2 border-ink bg-surface">
      {TABS.map(([href, key]) => (
        <Link
          key={key}
          href={href}
          aria-current={current === key ? 'page' : undefined}
          className={`flex min-h-14 items-center justify-center type-label ${current === key ? 'bg-palm-100' : ''}`}
        >
          {t(key)}
        </Link>
      ))}
    </nav>
  );
}
