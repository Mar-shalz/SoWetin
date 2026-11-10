import Link from 'next/link';
import { signOut } from '@/app/(admin)/admin/actions';
import { t } from '@/lib/admin/t';

export function AdminHeader({ email }: { email?: string }) {
  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
      <nav className="flex flex-wrap items-center gap-5" aria-label={t('meta.title')}>
        <Link href="/admin" className="type-title-m">
          {t('meta.title')}
        </Link>
        <Link href="/admin" className="text-enamel underline">
          {t('nav.dishes')}
        </Link>
        <Link href="/admin/prices" className="text-enamel underline">
          {t('nav.prices')}
        </Link>
        <Link href="/admin/pairings" className="text-enamel underline">
          {t('nav.pairings')}
        </Link>
        <Link href="/admin/ingredients" className="text-enamel underline">
          {t('nav.ingredients')}
        </Link>
        <Link href="/admin/videos" className="text-enamel underline">
          {t('nav.videos')}
        </Link>
        <Link href="/admin/ai" className="text-enamel underline">
          {t('nav.ai')}
        </Link>
        <Link href="/admin/settings" className="text-enamel underline">
          {t('nav.settings')}
        </Link>
      </nav>
      <form action={signOut} className="flex flex-wrap items-center gap-3">
        {email && <span className="type-caption text-ink-2">{t('nav.signedInAs', { email })}</span>}
        <button className="min-h-12 rounded-pill border-2 border-ink bg-surface px-4 type-label">{t('nav.signOut')}</button>
      </form>
    </header>
  );
}
