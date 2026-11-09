import { ActionForm } from '@/components/admin/action-form';
import { Choice, Input } from '@/components/admin/fields';
import { AdminHeader } from '@/components/admin/header';
import { requireStaff } from '@/lib/admin/guard';
import { LANGS } from '@/lib/admin/method';
import { t } from '@/lib/admin/t';
import { saveIngredient } from '../catalogue-actions';

type Ingredient = {
  id: string;
  name: string;
  category: string;
  canonical_unit: string;
  local_names: Record<string, string>;
  allergens: string[];
  may_contain: string[];
  house_group: 'foodstuff' | 'basic' | null;
};

// A-07 Ingredients (doc 02): names, local names and the house group. Allergens show but are locked (doc 05, 5.2).
// shortcut: the weekly list of custom house items people typed (BR-134) needs accounts, so it isn't here yet.
export default async function IngredientsPage() {
  const { supabase, user } = await requireStaff();
  const { data } = await supabase
    .from('ingredients')
    .select('id, name, category, canonical_unit, local_names, allergens, may_contain, house_group')
    .order('name');
  const rows = (data ?? []) as Ingredient[];
  return (
    <>
      <AdminHeader email={user.email} />
      <main>
        <h1 className="type-title-l">{t('ingredients.title')}</h1>
        <p className="mt-2 text-ink-2">{t('ingredients.intro')}</p>
        <ul className="mt-6 grid gap-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-lg border border-line bg-surface p-4">
              <p className="type-label">
                {r.name}{' '}
                <span className="text-ink-2">
                  · {r.id} · {r.category} · {r.canonical_unit}
                </span>
              </p>
              <p className="type-caption text-ink-2">
                {t('ingredients.allergens', { list: [...r.allergens, ...r.may_contain.map((m) => `${m}?`)].join(', ') || '0' })}
              </p>
              <details className="mt-2">
                <summary className="min-h-12 cursor-pointer py-3 text-enamel underline">{t('ingredients.edit')}</summary>
                <ActionForm action={saveIngredient} submit={t('review.save')} pending={t('review.saving')} className="mt-2 grid gap-3 md:grid-cols-4">
                  <input type="hidden" name="id" value={r.id} />
                  <Input label={t('ingredients.name')} name="name" required defaultValue={r.name} className="md:col-span-2" />
                  <Choice
                    label={t('ingredients.house')}
                    name="house_group"
                    defaultValue={r.house_group ?? ''}
                    options={[
                      ['', t('ingredients.houseNone')],
                      ['foodstuff', t('ingredients.houseFood')],
                      ['basic', t('ingredients.houseBasic')],
                    ]}
                    className="md:col-span-2"
                  />
                  {LANGS.map((l) => (
                    <Input key={l} label={t(`langs.${l}`)} name={`local_names.${l}`} defaultValue={r.local_names[l] ?? ''} />
                  ))}
                </ActionForm>
              </details>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
