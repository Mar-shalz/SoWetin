import Link from 'next/link';
import { signOut } from '@/app/(admin)/admin/actions';
import { t } from '@/lib/admin/t';

export function AdminHeader({ email }: { email?: string }) {
  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
      <Link href="/admin" className="type-title-m">
        {t('meta.title')}
      </Link>
      <form action={signOut} className="flex flex-wrap items-center gap-3">
        {email && <span className="type-caption text-ink-2">{t('nav.signedInAs', { email })}</span>}
        <button className="min-h-12 rounded-pill border-2 border-ink bg-surface px-4 type-label">{t('nav.signOut')}</button>
      </form>
    </header>
  );
}
