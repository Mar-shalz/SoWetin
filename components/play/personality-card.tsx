import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ChevronIcon, LogoMark } from '@/components/ui/icons';

// The way into the Chop Personality game: the same card on Decide and on Me (Victor, 10 November 2026).
export async function PersonalityCard() {
  const t = await getTranslations('persona.entry');
  return (
    <Link href="/play" className="flex items-center gap-4 rounded-lg border-2 border-ink bg-egusi-100 p-4 shadow-button">
      <span className="grid size-14 shrink-0 place-items-center rounded-pill border-2 border-ink bg-egusi">
        <LogoMark size={34} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block type-title-m">{t('title')}</span>
        <span className="block type-caption text-ink-2">{t('body')}</span>
      </span>
      <span className="grid size-11 shrink-0 place-items-center rounded-pill border-2 border-ink bg-palm">
        <span className="sr-only">{t('cta')}</span>
        <ChevronIcon size={20} />
      </span>
    </Link>
  );
}
