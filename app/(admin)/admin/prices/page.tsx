import { ActionForm } from '@/components/admin/action-form';
import { Area, Choice, Input } from '@/components/admin/fields';
import { AdminHeader } from '@/components/admin/header';
import { requireStaff } from '@/lib/admin/guard';
import { t } from '@/lib/admin/t';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { formatNaira } from '@/lib/i18n/money';
import { addSource, recomputeAll, runScout, setSourceActive } from './actions';

// A scout run reads a few pages with a pause between each, so it gets the longest function time the plan allows.
export const maxDuration = 300;

type Source = {
  id: string;
  name: string;
  domain: string;
  kind: 'press_survey' | 'official_stats' | 'online_store';
  terms_checked_at: string | null;
  active: boolean;
};
type Run = {
  id: string;
  started_at: string;
  finished_at: string | null;
  pages_read: number;
  kept: number;
  rejected: { url: string; quote?: string; reason: string }[];
  move_alerts: { ingredient_id: string; pct: number }[];
};
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
  const [{ data: sourceRows }, { data: runRows }] =
    role === 'admin'
      ? await Promise.all([
          supabase.from('price_sources').select('id, name, domain, kind, terms_checked_at, active').order('name'),
          supabase
            .from('scout_runs')
            .select('id, started_at, finished_at, pages_read, kept, rejected, move_alerts')
            .order('started_at', { ascending: false })
            .limit(5),
        ])
      : [{ data: [] }, { data: [] }];
  const sources = (sourceRows ?? []) as Source[];
  const runs = (runRows ?? []) as Run[];
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: C.TIMEZONE }).format(new Date());
  const when = (iso: string) =>
    new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: C.TIMEZONE }).format(new Date(iso));
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
        ) : null}
        {role === 'admin' && (
          <section className="rounded-lg border border-line bg-surface p-5" aria-labelledby="scout">
            <h2 id="scout" className="type-title-m">
              {t('prices.scout.title')}
            </h2>
            <p className="mt-2 text-ink-2">{t('prices.scout.intro')}</p>

            <h3 className="mt-5 type-label">{t('prices.scout.sourcesTitle')}</h3>
            {sources.length ? (
              <table className="mt-2 w-full border-collapse text-left">
                <thead>
                  <tr className="border-b-2 border-ink type-label">
                    <th className="py-2 pr-4">{t('prices.scout.colName')}</th>
                    <th className="py-2 pr-4">{t('prices.scout.colDomain')}</th>
                    <th className="py-2 pr-4">{t('prices.scout.colKind')}</th>
                    <th className="py-2 pr-4">{t('prices.scout.colTerms')}</th>
                    <th className="py-2">{t('prices.scout.colActive')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((s) => (
                    <tr key={s.id} className="border-b border-line align-top">
                      <td className="py-3 pr-4">{s.name}</td>
                      <td className="py-3 pr-4">{s.domain}</td>
                      <td className="py-3 pr-4">{t(`prices.scout.kinds.${s.kind}`)}</td>
                      <td className="py-3 pr-4">{s.terms_checked_at ?? ''}</td>
                      <td className="py-3">
                        <ActionForm quiet action={setSourceActive} submit={s.active ? t('prices.scout.pause') : t('prices.scout.resume')} pending="…">
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="active" value={String(!s.active)} />
                        </ActionForm>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-2 text-ink-2">{t('prices.scout.noSourcesYet')}</p>
            )}

            <h3 className="mt-6 type-label">{t('prices.scout.addTitle')}</h3>
            <p className="text-ink-2">{t('prices.scout.addHint')}</p>
            <ActionForm action={addSource} submit={t('prices.scout.add')} pending={t('prices.scout.adding')} className="mt-2 grid gap-3 md:grid-cols-2">
              <Input label={t('prices.scout.name')} name="name" required maxLength={80} />
              <Input label={t('prices.scout.domain')} name="domain" required maxLength={120} />
              <Choice
                label={t('prices.scout.kind')}
                name="kind"
                options={(['press_survey', 'official_stats', 'online_store'] as const).map((k): [string, string] => [k, t(`prices.scout.kinds.${k}`)])}
              />
              <Input label={t('prices.scout.terms')} name="terms_checked_at" type="date" required max={today} />
            </ActionForm>

            <h3 className="mt-6 type-label">{t('prices.scout.runTitle')}</h3>
            <p className="text-ink-2">{t('prices.scout.runHint', { max: C.SCOUT_MAX_PAGES_PER_RUN })}</p>
            <ActionForm action={runScout} submit={t('prices.scout.run')} pending={t('prices.scout.running')} className="mt-2">
              <Area label={t('prices.scout.urls')} name="urls" rows={3} required />
            </ActionForm>

            {!!runs.length && (
              <>
                <h3 className="mt-6 type-label">{t('prices.scout.runsTitle')}</h3>
                <table className="mt-2 w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b-2 border-ink type-label">
                      <th className="py-2 pr-4">{t('prices.scout.colStarted')}</th>
                      <th className="py-2 pr-4">{t('prices.scout.colPages')}</th>
                      <th className="py-2 pr-4">{t('prices.scout.colKept')}</th>
                      <th className="py-2">{t('prices.scout.colRejected')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r) => (
                      <tr key={r.id} className="border-b border-line align-top">
                        <td className="py-3 pr-4">
                          {when(r.started_at)}
                          {!r.finished_at && <span className="block text-amber">{t('prices.scout.unfinished')}</span>}
                        </td>
                        <td className="py-3 pr-4">{r.pages_read}</td>
                        <td className="py-3 pr-4">{r.kept}</td>
                        <td className="py-3">
                          {r.rejected.length}
                          {!!r.rejected.length && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-enamel underline">{t('prices.scout.details')}</summary>
                              <ul className="mt-1 grid gap-1 type-caption">
                                {r.rejected.map((x, i) => (
                                  <li key={i}>
                                    {x.reason}: {x.quote ?? x.url}
                                  </li>
                                ))}
                              </ul>
                            </details>
                          )}
                          {!!r.move_alerts.length && (
                            <p className="mt-1 text-amber">
                              {t('prices.scout.moves', { list: r.move_alerts.map((m) => `${m.ingredient_id} ${m.pct}%`).join(', ') })}
                            </p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>
        )}
        {role !== 'admin' && <p className="text-ink-2">{t('prices.adminOnly')}</p>}
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
