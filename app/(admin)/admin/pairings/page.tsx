import { ActionForm } from '@/components/admin/action-form';
import { Choice, Input } from '@/components/admin/fields';
import { AdminHeader } from '@/components/admin/header';
import { requireStaff } from '@/lib/admin/guard';
import { t } from '@/lib/admin/t';
import { savePairing } from '../catalogue-actions';

type Pairing = { component_a: string; component_b: string; score: number; note: string | null; status: 'draft' | 'approved' };

// A-06 Pairings (doc 02): every pairing with its note; a person approves each one before the engine uses it (BR-42).
export default async function PairingsPage() {
  const { supabase, user } = await requireStaff();
  const [{ data }, { data: comps }] = await Promise.all([
    supabase.from('pairings').select('component_a, component_b, score, note, status').order('status').order('component_a'),
    supabase.from('components').select('id, name'),
  ]);
  const name = new Map((comps ?? []).map((c) => [c.id as string, c.name as string]));
  const rows = (data ?? []) as Pairing[];
  return (
    <>
      <AdminHeader email={user.email} />
      <main>
        <h1 className="type-title-l">{t('pairings.title')}</h1>
        <p className="mt-2 text-ink-2">{t('pairings.intro', { approved: rows.filter((r) => r.status === 'approved').length, total: rows.length })}</p>
        <ul className="mt-6 grid gap-3">
          {rows.map((r) => (
            <li key={`${r.component_a}|${r.component_b}`} className="rounded-lg border border-line bg-surface p-4">
              <p className="type-label">
                {name.get(r.component_a) ?? r.component_a} + {name.get(r.component_b) ?? r.component_b}
              </p>
              {r.note && <p className="text-ink-2">{r.note}</p>}
              <ActionForm action={savePairing} submit={t('pairings.save')} pending={t('review.saving')} className="mt-2 grid items-end gap-3 md:grid-cols-3">
                <input type="hidden" name="a" value={r.component_a} />
                <input type="hidden" name="b" value={r.component_b} />
                <Choice
                  label={t('pairings.status')}
                  name="status"
                  defaultValue={r.status}
                  options={[
                    ['approved', t('pairings.approved')],
                    ['draft', t('pairings.draft')],
                  ]}
                />
                <Input label={t('pairings.score')} name="score" type="number" min={0} max={1} step={0.05} defaultValue={r.score} />
              </ActionForm>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
