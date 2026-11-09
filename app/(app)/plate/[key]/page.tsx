import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { plateComponents } from '@/lib/engine/plate';
import { pictureUrl } from '@/lib/db/env';
import { formatNaira } from '@/lib/i18n/money';
import { catalogueForRequest, costFn, lagosToday, parsePlateKey } from '@/lib/plates/serve';
import { cookServings } from '@/lib/pricing/costPlate';

type Method = {
  id: string;
  status: string;
  tips: string[];
  mistakes: string[];
  storage: string | null;
  serving_note: string | null;
  component_steps: { step_no: number; text: string; cue: string | null; heat: 'low' | 'medium' | 'high' | null; timer_seconds: number | null }[];
};
const round = (n: number) => Math.round(n / C.PRICE_ROUNDING_NGN) * C.PRICE_ROUNDING_NGN;
const amount = (n: number) => (n >= 10 ? Math.round(n) : Math.round(n * 10) / 10);

// S-004 written method first and S-006 market list, for one plate and a people count (doc 07, GET /plates/{plateKey}).
// shortcut: one page for both, no tabs, cook mode or videos yet (M2 polish), and amounts in grams until market words land.
export default async function PlatePage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ people?: string }> }) {
  const [{ key }, sp, t] = await Promise.all([params, searchParams, getTranslations()]);
  const people = Math.min(C.PEOPLE_MAX, Math.max(C.PEOPLE_MIN, Number(sp.people) || C.PEOPLE_DEFAULT));
  const { cat, client } = await catalogueForRequest();
  const plate = cat && parsePlateKey(decodeURIComponent(key), cat);
  if (!cat || !client || !plate) notFound();

  const ids = plateComponents(plate);
  const cost = costFn(cat, people, { cooked: [], foodstuff: [], basic: [] }, lagosToday())(plate);
  const { data } = await client
    .from('components')
    .select('id, status, tips, mistakes, storage, serving_note, component_steps(step_no, text, cue, heat, timer_seconds)')
    .in('id', ids);
  const methods = new Map(((data ?? []) as Method[]).map((m) => [m.id, m]));
  // Cooking order (doc 07): the component that takes longest starts first.
  const order = [...ids].sort((a, b) => (cat.display.get(b)?.totalMinutes ?? 0) - (cat.display.get(a)?.totalMinutes ?? 0));
  const allPublished = ids.every((id) => cat.display.get(id)?.status === 'published');
  const unit = (id: string) => cat.book.ingredients[id]?.canonicalUnit ?? 'g';

  return (
    <main className="mx-auto flex min-h-dvh max-w-app flex-col gap-6 px-4 py-6">
      <Link href="/" className="text-enamel underline">
        {t('detail.back')}
      </Link>
      <h1 className="type-display-l">{ids.map((id) => cat.display.get(id)?.name ?? id).join(' + ')}</h1>

      {cost && (
        <section aria-labelledby="price">
          <p id="price" className="type-price-l">
            {t('plate.price.range', { low: formatNaira(cost.outlayLowNgn), high: formatNaira(cost.outlayHighNgn) })}
          </p>
          <p className="type-caption text-ink-2">{t('plate.price.today')}</p>
          <p className="mt-2 type-caption text-ink-2">{t('prices.note.line')}</p>
        </section>
      )}

      <section aria-labelledby="cook" className="grid gap-5">
        <h2 id="cook" className="type-title-l">
          {t('recipe.title')}
        </h2>
        {order.map((id) => {
          const c = cat.snap.components.get(id)!;
          const m = methods.get(id);
          const servings = cookServings({ id, batchServingsMin: c.batchServingsMin, lines: [] }, people);
          const steps = [...(m?.component_steps ?? [])].sort((a, b) => a.step_no - b.step_no);
          return (
            <article key={id} className="rounded-lg border-2 border-ink bg-surface p-4">
              {cat.display.get(id)?.picture && (
                <Image
                  src={pictureUrl(cat.display.get(id)!.picture)!}
                  alt={cat.display.get(id)!.name}
                  width={640}
                  height={480}
                  sizes="(max-width: 480px) 100vw, 480px"
                  className="mb-3 aspect-[4/3] w-full rounded-md object-cover"
                />
              )}
              <h3 className="type-title-m">{cat.display.get(id)?.name}</h3>
              <h4 className="mt-3 type-label">{t('recipe.ingredients', { people: servings })}</h4>
              <ul className="mt-1 grid gap-1">
                {c.lines.map((l) => (
                  <li key={l.ingredientId}>
                    {cat.names.get(l.ingredientId) ?? l.ingredientId}
                    {l.qtyPerServing !== null && (
                      <span className="text-ink-2">
                        {' '}
                        {amount(l.qtyPerServing * servings)} {unit(l.ingredientId)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <h4 className="mt-4 type-label">{t('recipe.steps')}</h4>
              {steps.length ? (
                <ol className="mt-1 grid list-decimal gap-3 pl-6">
                  {steps.map((s) => (
                    <li key={s.step_no} className="type-cook-step">
                      {s.text}
                      {(s.heat || s.timer_seconds) && (
                        <span className="mt-1 block type-label text-ink-2">
                          {[s.heat && t(`recipe.heat.${s.heat}`), s.timer_seconds && t('plate.why.time', { minutes: Math.round(s.timer_seconds / 60) })]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                      {s.cue && <span className="block type-body-m text-ink-2">{s.cue}</span>}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-1 text-ink-2">{t('recipe.notYet')}</p>
              )}
              {!!m?.tips.length && (
                <>
                  <h4 className="mt-4 type-label">{t('recipe.tips')}</h4>
                  <ul className="list-disc pl-6">
                    {m.tips.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </>
              )}
              {!!m?.mistakes.length && (
                <>
                  <h4 className="mt-4 type-label">{t('recipe.mistakes')}</h4>
                  <ul className="list-disc pl-6">
                    {m.mistakes.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </>
              )}
              {m?.storage && (
                <p className="mt-4">
                  <span className="type-label">{t('recipe.storage')}:</span> {m.storage}
                </p>
              )}
              {m?.serving_note && (
                <p className="mt-1">
                  <span className="type-label">{t('recipe.serve')}:</span> {m.serving_note}
                </p>
              )}
            </article>
          );
        })}
        {allPublished && <p className="type-caption text-ink-2">{t('recipes.note.line')}</p>}
      </section>

      {cost && (
        <section aria-labelledby="market" className="grid gap-2">
          <h2 id="market" className="type-title-l">
            {t('market.title')}
          </h2>
          <ul className="grid gap-2">
            {cost.lines
              .filter((l) => l.bought.length)
              .map((l) => (
                <li key={l.ingredientId} className="flex justify-between gap-3 border-b border-line pb-2">
                  <span>
                    {cat.names.get(l.ingredientId) ?? l.ingredientId}
                    <span className="block type-caption text-ink-2">{l.bought.map((b) => `${b.count} × ${b.label}`).join(', ')}</span>
                  </span>
                  <span className="shrink-0">{formatNaira(round(l.outlayMid))}</span>
                </li>
              ))}
          </ul>
          <p className="type-label">{t('market.total', { low: formatNaira(cost.outlayLowNgn), high: formatNaira(cost.outlayHighNgn) })}</p>
          <p className="type-caption text-ink-2">{t('market.footer', { area: t('areas.lagos'), date: cost.oldestPriceDate })}</p>
        </section>
      )}
    </main>
  );
}
