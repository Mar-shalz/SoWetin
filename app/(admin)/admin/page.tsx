import Link from 'next/link';
import { ActionForm } from '@/components/admin/action-form';
import { AdminHeader } from '@/components/admin/header';
import { requireStaff } from '@/lib/admin/guard';
import { t, type Blocker } from '@/lib/admin/t';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { requestDrafts } from './actions';

// AI drafts run inside this page's actions, a few at a time.
export const maxDuration = 120;

type Row = {
  id: string;
  name: string;
  status: 'draft' | 'in_review' | 'published' | 'retired';
  publish_blockers: Blocker[] | null;
  content_drafts: { status: string }[];
};

// A-01 and A-02 in one screen for now: how far the catalogue is, and every dish with what it still needs.
export default async function AdminHome() {
  const { supabase, user } = await requireStaff();
  const { data } = await supabase.from('components').select('id, name, status, publish_blockers, content_drafts(status)').order('name');
  const rows = (data ?? []) as Row[];
  const waiting = (r: Row) => r.content_drafts.some((d) => d.status === 'needs_review');
  return (
    <>
      <AdminHeader email={user.email} />
      <main>
        <h1 className="type-title-l">{t('home.title')}</h1>
        <p className="mt-2 text-ink-2">
          {t('home.counts', {
            total: rows.length,
            published: rows.filter((r) => r.status === 'published').length,
            waiting: rows.filter(waiting).length,
          })}
        </p>
        <ActionForm action={requestDrafts} submit={t('home.draftNext', { count: C.AI_DRAFT_BATCH })} pending={t('home.drafting')} />
        <table className="mt-8 w-full border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-ink type-label">
              <th className="py-2 pr-4">{t('home.colDish')}</th>
              <th className="py-2 pr-4">{t('home.colStatus')}</th>
              <th className="py-2 pr-4">{t('home.colNeeds')}</th>
              <th className="py-2">{t('home.colDraft')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line align-top">
                <td className="py-3 pr-4">
                  <Link href={`/admin/dishes/${r.id}`} className="text-enamel underline">
                    {r.name}
                  </Link>
                </td>
                <td className="py-3 pr-4">{t(`status.${r.status}`)}</td>
                <td className="py-3 pr-4 text-ink-2">
                  {r.status === 'published' ? '' : r.publish_blockers?.length ? r.publish_blockers.map((b) => t(`blockers.${b}`)).join(', ') : t('home.ready')}
                </td>
                <td className="py-3">{waiting(r) ? t('home.waiting') : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </>
  );
}
