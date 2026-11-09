'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CaretIcon } from '@/components/ui/icons';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { formatNaira } from '@/lib/i18n/money';
import type { PlateView } from '@/lib/plates/serve';

type State = 'ok' | 'tight' | 'empty' | 'none_left' | 'buy_unavailable';
type Result = { state: State; staff_preview?: boolean; plates: PlateView[] };
const SLOW_MS = 3000;

const lagosToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: C.TIMEZONE }).format(new Date());
const daysAgo = (iso: string) => Math.max(0, Math.round((Date.parse(lagosToday()) - Date.parse(iso)) / 86_400_000));

// S-001 Decide: the one-sentence answers (budget, people, cook or buy), then Pick for me (one plate) or three plates.
// shortcut: native pickers behind the answer pills; the bottom sheets and motion of doc 10 come with the M2 polish.
export function Decide({ children }: { children?: ReactNode }) {
  const t = useTranslations();
  const [budget, setBudget] = useState<number>(C.FIRST_VISIT_DEFAULT_BUDGET);
  const [people, setPeople] = useState<number>(C.PEOPLE_DEFAULT);
  const [mode, setMode] = useState<'cook' | 'buy'>('cook');
  const [result, setResult] = useState<Result | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [failed, setFailed] = useState(false);
  const [noneLeft, setNoneLeft] = useState(false);
  const answer = useRef<HTMLElement>(null);
  // New answers scroll into view above the sticky buttons; instantly when the phone asks for reduced motion (doc 10).
  useEffect(() => {
    if (result || failed)
      answer.current?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [result, failed]);

  async function ask(deckSize: number, exclude: string[]): Promise<Result | null> {
    setBusy(true);
    setFailed(false);
    const timer = setTimeout(() => setSlow(true), SLOW_MS);
    try {
      const res = await fetch('/api/v1/suggestions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ budget_ngn: budget, people, mode, deck_size: deckSize, exclude_plate_keys: exclude }),
      });
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as Result;
    } catch {
      setFailed(true);
      return null;
    } finally {
      clearTimeout(timer);
      setSlow(false);
      setBusy(false);
    }
  }

  async function pick(deckSize: number) {
    setNoneLeft(false);
    const r = await ask(deckSize, []);
    if (!r) return;
    setResult(r);
    setSeen(r.plates.map((p) => p.plate_key));
  }

  // "Not this": swap that one card for the next best plate nobody has seen this session.
  async function replace(i: number) {
    if (!result) return;
    const r = await ask(1, seen);
    if (!r) return;
    if (!r.plates.length) return setNoneLeft(true);
    const next = r.plates[0];
    setResult({ ...result, plates: result.plates.map((p, j) => (j === i ? next : p)) });
    setSeen([...seen, next.plate_key]);
  }

  const peopleLabel = t('home.sentence.people', { count: people });
  const answers = {
    budget: {
      label: formatNaira(budget),
      value: String(budget),
      options: [...new Set([...C.BUDGET_CHIPS, budget])].sort((a, b) => a - b).map((b): [string, string] => [String(b), formatNaira(b)]),
      set: (v: string) => setBudget(Number(v)),
    },
    people: {
      label: peopleLabel,
      value: String(people),
      options: Array.from({ length: C.PEOPLE_MAX - C.PEOPLE_MIN + 1 }, (_, k): [string, string] => [
        String(k + C.PEOPLE_MIN),
        t('home.sentence.people', { count: k + C.PEOPLE_MIN }),
      ]),
      set: (v: string) => setPeople(Number(v)),
    },
    mode: {
      label: t(`home.sentence.${mode}`),
      value: mode,
      options: [
        ['cook', t('home.sentence.cook')],
        ['buy', t('home.sentence.buy')],
      ] as [string, string][],
      set: (v: string) => setMode(v as 'cook' | 'buy'),
    },
  };
  // Odd entries are placeholder names: "I have {budget} for {people}..." becomes words and answer pills.
  // Punctuation right after a pill stays glued to it, so a line never starts with a comma.
  const sentence = (t.raw('home.sentence._') as string).split(/\{(\w+)\}/);
  const glued = (i: number) => (i % 2 ? (sentence[i + 1]?.match(/^[,.!?]/)?.[0] ?? '') : '');

  return (
    <>
      <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-3 type-title-l">
        {sentence.map((part, i) => {
          if (i % 2) {
            const a = answers[part as keyof typeof answers];
            return (
              <span key={i} className="inline-flex items-center">
                <span className="relative inline-flex min-h-12 items-center gap-1 rounded-pill border-2 border-ink bg-palm-100 px-3 shadow-button focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-focus">
                  {a.label}
                  <CaretIcon size={20} />
                  <select
                    aria-label={t('home.sentence.edit', { value: a.label })}
                    value={a.value}
                    onChange={(e) => a.set(e.target.value)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  >
                    {a.options.map(([v, text]) => (
                      <option key={v} value={v}>
                        {text}
                      </option>
                    ))}
                  </select>
                </span>
                {glued(i)}
              </span>
            );
          }
          const words = (glued(i - 1) ? part.slice(1) : part).trim();
          return words && <span key={i}>{words}</span>;
        })}
      </p>
      <p className="mt-3 type-caption text-ink-2">{t('home.sentence.hint')}</p>
      {children}

      <section ref={answer} aria-live="polite" className="mt-6 grid scroll-mt-4 gap-4">
        {slow && <p className="text-ink-2">{t('reveal.slow')}</p>}
        {failed && <p className="text-scotch">{t('error.generic')}</p>}
        {result && <Results result={result} budget={budget} people={people} peopleLabel={peopleLabel} onNotThis={replace} busy={busy} />}
        {noneLeft && <p className="text-ink-2">{t('plate.skip.none')}</p>}
      </section>

      <div className="sticky bottom-0 mt-auto bg-cream pb-2 pt-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => pick(1)}
          className="flex min-h-14 w-full items-center justify-center rounded-pill border-2 border-ink bg-palm shadow-button type-title-m disabled:opacity-60"
        >
          {t('home.cta.pick')}
        </button>
        <button type="button" disabled={busy} onClick={() => pick(C.DECK_SIZE)} className="mx-auto mt-1 block min-h-12 type-label underline underline-offset-4">
          {t('home.cta.show3Instead')}
        </button>
      </div>
    </>
  );
}

function Results({
  result,
  budget,
  people,
  peopleLabel,
  onNotThis,
  busy,
}: {
  result: Result;
  budget: number;
  people: number;
  peopleLabel: string;
  onNotThis: (i: number) => void;
  busy: boolean;
}) {
  const t = useTranslations();
  if (result.state === 'buy_unavailable') return <p>{t('deck.buyLater')}</p>;
  if (!result.plates.length) return <p>{t(result.state === 'none_left' ? 'plate.skip.none' : 'deck.empty')}</p>;
  return (
    <>
      {result.staff_preview && <p className="rounded-md bg-amber-100 p-3 type-caption">{t('deck.staffPreview')}</p>}
      {result.state === 'tight' ? (
        <div>
          <h2 className="type-title-m">{t('deck.tight.title', { budget: formatNaira(budget), people: peopleLabel })}</h2>
          <p className="text-ink-2">{t('deck.tight.subtitle')}</p>
        </div>
      ) : (
        <div>
          <h2 className="type-title-m">{t(result.plates.length > 1 ? 'plate.title.deck' : 'plate.title.single')}</h2>
          <p className="type-caption text-ink-2">{t('plate.basis', { budget: formatNaira(budget), people: peopleLabel })}</p>
        </div>
      )}
      {result.plates.map((p, i) => (
        <PlateCard key={p.plate_key} plate={p} budget={budget} people={people} tight={result.state === 'tight'} onNotThis={() => onNotThis(i)} busy={busy} />
      ))}
    </>
  );
}

function PlateCard({
  plate: p,
  budget,
  people,
  tight,
  onNotThis,
  busy,
}: {
  plate: PlateView;
  budget: number;
  people: number;
  tight: boolean;
  onNotThis: () => void;
  busy: boolean;
}) {
  const t = useTranslations();
  const price = p.price;
  const meta =
    price.freshness === 'fresh'
      ? t('plate.price.meta.fresh', {
          area: t('areas.lagos'),
          relative: new Intl.RelativeTimeFormat('en-NG', { numeric: 'auto' }).format(-daysAgo(price.checked_on), 'day'),
        })
      : price.freshness === 'ageing'
        ? t('plate.price.meta.ageing', {
            area: t('areas.lagos'),
            date: new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short' }).format(new Date(price.checked_on)),
          })
        : t('plate.price.estimate');
  const spare = budget - price.high_ngn;
  const picture = p.slots.find((s) => s.component.picture)?.component.picture;
  return (
    <article className="rounded-lg border-2 border-ink bg-surface p-4">
      {picture && (
        <Image
          src={picture}
          alt={p.title}
          width={640}
          height={480}
          sizes="(max-width: 480px) 100vw, 480px"
          className="mb-3 aspect-[4/3] w-full rounded-md object-cover"
        />
      )}
      <h3 className="type-title-m">{p.title}</h3>
      <p className="mt-2 type-price-l">{t('plate.price.range', { low: formatNaira(price.low_ngn), high: formatNaira(price.high_ngn) })}</p>
      <p className="type-caption text-ink-2">{t('plate.price.today')}</p>
      {price.pot ? (
        <p className="mt-1">
          {t('plate.price.pot', {
            component: price.pot.component,
            servings: price.pot.servings,
            more: price.pot.more_meals,
            perPlate: formatNaira(price.per_plate_ngn),
          })}
        </p>
      ) : (
        price.show_use_line && <p className="mt-1">{t('plate.price.uses', { amount: formatNaira(price.plate_use_ngn) })}</p>
      )}
      <p className={`mt-2 type-caption ${price.freshness === 'stale' ? 'text-amber' : 'text-ink-2'}`}>
        {meta} · {t('plate.why.time', { minutes: p.total_minutes })}
      </p>
      {tight ? (
        <p className="mt-1 type-label text-amber">{t('deck.tight.gap', { amount: formatNaira(price.gap_ngn) })}</p>
      ) : price.stretch ? (
        <p className="mt-1 type-label text-amber">{t('plate.badge.over')}</p>
      ) : (
        spare >= 0 && <p className="mt-1 type-label text-ugu">{t('plate.why.fits', { budget: formatNaira(budget), spare: formatNaira(spare) })}</p>
      )}
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={onNotThis}
          className="min-h-12 flex-1 rounded-pill border-2 border-ink bg-surface px-4 type-label disabled:opacity-60"
        >
          {t('plate.cta.notThis')}
        </button>
        <Link
          href={`/plate/${encodeURIComponent(p.plate_key)}?people=${people}`}
          className="flex min-h-12 flex-1 items-center justify-center rounded-pill border-2 border-ink bg-palm px-4 type-label"
        >
          {t('plate.cta.go')}
        </Link>
      </div>
    </article>
  );
}
