import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { CompassIcon, HeartIcon, PotIcon, UserIcon } from '@/components/ui/icons';

// The bottom bar (doc 02): Decide, Explore, Saved, Me. An icon and a label on every tab, and the tab you're on sits in a
// palm pill, so where you are never depends on colour alone (aria-current says it too). Cook mode and sheets don't show it.
const TABS = [
  ['/', 'decide', PotIcon],
  ['/explore', 'explore', CompassIcon],
  ['/saved', 'saved', HeartIcon],
  ['/me', 'me', UserIcon],
] as const;

export async function BottomNav({ current }: { current: (typeof TABS)[number][1] }) {
  const t = await getTranslations('nav');
  return (
    <nav
      aria-label={t('label')}
      className="sticky bottom-0 z-10 -mx-4 mt-6 grid grid-cols-4 border-t-2 border-ink bg-surface px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2"
    >
      {TABS.map(([href, key, Icon]) => {
        const on = current === key;
        return (
          <Link
            key={key}
            href={href}
            aria-current={on ? 'page' : undefined}
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg type-caption font-semibold"
          >
            <span className={`grid h-8 w-14 place-items-center rounded-pill ${on ? 'sw-pop bg-palm text-ink' : 'text-ink-2'}`}>
              <Icon size={22} />
            </span>
            <span className={on ? 'text-ink' : 'text-ink-2'}>{t(key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
