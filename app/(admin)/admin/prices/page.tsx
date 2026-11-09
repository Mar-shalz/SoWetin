import { ActionForm } from '@/components/admin/action-form';
import { AdminHeader } from '@/components/admin/header';
import { requireStaff } from '@/lib/admin/guard';
import { t } from '@/lib/admin/t';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { formatNaira } from '@/lib/i18n/money';
import { recomputeAll } from './actions';
import { ImportForm } from './import-form';

type Point = {
  ingredient_id: string;
  per_unit_low: number;
  per_unit_mid: number;
  per_unit_high: number;
  confidence: 'high' | 'medium' | 'low';
  as_of: string;
  source_count: number;
  ingredients: { name: string; market_units: { label: string; canonical_qty: number; is_minimum: boolean; area_id: string }[] } | null;
};

// A-04 Prices, first part: the Lagos price table, the market check import and the survey sheet (doc 04, section 9).
export default async function PricesPage() {
  const { supabase, user, role } = await requireStaff();
  const { data } = await supabase
    .from('price_points')
    .select(
      'ingredient_id, per_unit_low, per_unit_mid, per_unit_high, confidence, as_of, source_count, ingredients(name, market_units(label, canonical_qty, is_minimum, area_id))',
    )
    .eq('area_id', C.DEFAULT_AREA)
    .order('ingredient_id');
  const points = (data ?? []) as unknown as Point[];
  return (
    <>
      <AdminHeader email={user.email} />
      <main className="grid gap-8">
        <div>
          <h1 className="type-title-l">{t('prices.title')}</h1>
          <p className="mt-2 text-ink-2">{t('prices.intro', { count: points.length })}</p>
        </div>
        {role === 'admin' ? (
          <section className="rounded-lg border border-line bg-surface p-5" aria-labelledby="import">
            <h2 id="import" className="type-title-m">
              {t('prices.importTitle')}
            </h2>
            <p className="mt-2">
              {t('prices.importHint')}{' '}
              <a href="/admin/prices/sheet" className="text-enamel underline">
                {t('prices.sheet')}
              </a>
            </p>
            <div className="mt-4">
              <ImportForm
                l={{
                  file: t('prices.file'),
                  paste: t('prices.paste'),
                  check: t('prices.check'),
                  checking: t('prices.checking'),
                  publish: t('prices.publish'),
                  publishing: t('prices.publishing'),
                  rows: t('prices.rows'),
                  problems: t('prices.problems'),
                  flagged: t('prices.flagged'),
                }}
              />
            </div>
            <ActionForm quiet action={recomputeAll} submit={t('prices.rebuild')} pending={t('prices.rebuilding')} className="mt-4" />
          </section>
        ) : (
          <p className="text-ink-2">{t('prices.adminOnly')}</p>
        )}
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-ink type-label">
              <th className="py-2 pr-4">{t('prices.colIngredient')}</th>
              <th className="py-2 pr-4">{t('prices.colRange')}</th>
              <th className="py-2 pr-4">{t('prices.colConfidence')}</th>
              <th className="py-2 pr-4">{t('prices.colAsOf')}</th>
              <th className="py-2">{t('prices.colSources')}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => {
              const units = (p.ingredients?.market_units ?? []).filter((u) => u.area_id === C.DEFAULT_AREA);
              const unit = units.find((u) => u.is_minimum) ?? units[0];
              const qty = unit ? Number(unit.canonical_qty) : 1;
              return (
                <tr key={p.ingredient_id} className="border-b border-line align-top">
                  <td className="py-3 pr-4">{p.ingredients?.name ?? p.ingredient_id}</td>
                  <td className="py-3 pr-4">
                    {t('prices.range', {
                      unit: unit?.label ?? '',
                      low: formatNaira(Number(p.per_unit_low) * qty),
                      high: formatNaira(Number(p.per_unit_high) * qty),
                    })}
                  </td>
                  <td className="py-3 pr-4">{t(`prices.confidence.${p.confidence}`)}</td>
                  <td className="py-3 pr-4">{p.as_of}</td>
                  <td className="py-3">{p.source_count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </main>
    </>
  );
}
