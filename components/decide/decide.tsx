'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PriceSheet } from '@/components/decide/price-sheet';
import { EMPTY_KITCHEN, kitchenForApi, lagosToday as today, saveKitchen, useKitchen, type Kitchen } from '@/components/decide/kitchen';
import { CaretIcon, ChevronIcon, HouseIcon, SlidersIcon } from '@/components/ui/icons';
import type { HouseOptions } from '@/lib/catalogue/db';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import type { MealTime } from '@/lib/engine/time';
import { formatNaira } from '@/lib/i18n/money';
import type { PlateView } from '@/lib/plates/serve';

type State = 'ok' | 'tight' | 'empty' | 'none_left' | 'buy_unavailable';
type Result = { state: State; staff_preview?: boolean; plates: PlateView[] };
type Filters = { meal_time: MealTime | null; plate_types: string[]; max_total_minutes: number | null; spice_max: number | null; vegetarian: boolean };
type SheetProps = Omit<React.ComponentProps<typeof PriceSheet>, 'children' | 'className'>;
const NO_FILTERS: Filters = { meal_time: null, plate_types: [], max_total_minutes: null, spice_max: null, vegetarian: false };
const MEALS: MealTime[] = ['breakfast', 'lunch', 'dinner', 'late_night'];
const PLATE_TYPES = ['soup_swallow', 'rice_plate', 'one_pot', 'pasta_noodles', 'yam_plantain_sauce', 'breakfast_pair', 'snack', 'single'] as const;
const TIMES = [30, 45, 60];
const SLOW_MS = 3000;
const NOTE_KEY = 'sw_price_note_seen';

const lagosToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: C.TIMEZONE }).format(new Date());
const daysAgo = (iso: string) => Math.max(0, Math.round((Date.parse(lagosToday()) - Date.parse(iso)) / 86_400_000));
const activeFilters = (f: Filters) => [f.meal_time, f.plate_types.length, f.max_total_minutes, f.spice_max !== null, f.vegetarian].filter(Boolean).length;

// S-001 Decide: the top bar with Filters (S-007), the one-sentence answers, Pick for me or three plates (S-003),
// a Swap per dish (BR-37), and the price receipt (S-023).
// shortcut: native pickers and <dialog> sheets; the motion of doc 10 comes with the M2 polish.
export function Decide({ greeting, house, children }: { greeting: ReactNode; house: HouseOptions; children?: ReactNode }) {
  const t = useTranslations();
  const [budget, setBudget] = useState<number>(C.FIRST_VISIT_DEFAULT_BUDGET);
  const [people, setPeople] = useState<number>(C.PEOPLE_DEFAULT);
  const [mode, setMode] = useState<'cook' | 'buy'>('cook');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [result, setResult] = useState<Result | null>(null);
  const [deckSize, setDeckSize] = useState(1);
  const [seen, setSeen] = useState<string[]>([]);
  const [swapped, setSwapped] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const answer = useRef<HTMLElement>(null);
  const sheet = useRef<HTMLDialogElement>(null);
  const houseSheet = useRef<HTMLDialogElement>(null);
  const [houseOpens, setHouseOpens] = useState(0);
  const kitchen = useKitchen();
  const cooking = mode === 'cook';
  const inKitchen = cooking && kitchen.cooked.length + kitchen.foodstuff.length + kitchen.basic.length > 0;
  // New answers scroll into view above the sticky buttons; instantly when the phone asks for reduced motion (doc 10).
  useEffect(() => {
    if (result || failed)
      answer.current?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [result, failed]);

  const scene = (f: Filters = filters) => {
    const { meal_time, ...rest } = f;
    return { budget_ngn: budget, people, mode, meal_time, filters: rest, house: kitchenForApi(kitchen) };
  };

  async function post<T>(url: string, body: object): Promise<T | null> {
    setBusy(true);
    setFailed(false);
    setNotice(null);
    const timer = setTimeout(() => setSlow(true), SLOW_MS);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as T;
    } catch {
      setFailed(true);
      return null;
    } finally {
      clearTimeout(timer);
      setSlow(false);
      setBusy(false);
    }
  }

  async function pick(size: number, f: Filters = filters) {
    setDeckSize(size);
    const r = await post<Result>('/api/v1/suggestions', { ...scene(f), deck_size: size });
    if (!r) return;
    setResult(r);
    setSeen(r.plates.map((p) => p.plate_key));
    setSwapped({});
  }

  // "Not this": swap that one card for the next best plate nobody has seen this session.
  async function replace(i: number) {
    if (!result) return;
    const r = await post<Result>('/api/v1/suggestions', { ...scene(), deck_size: 1, exclude_plate_keys: seen });
    if (!r) return;
    if (!r.plates.length) return setNotice(t('plate.skip.none'));
    const next = r.plates[0];
    setResult({ ...result, plates: result.plates.map((p, j) => (j === i ? next : p)) });
    setSeen([...seen, next.plate_key]);
  }

  // Swap one dish (A-26): every other dish on the plate stays; dishes already offered for that slot aren't offered again.
  async function swap(i: number, slot: string) {
    if (!result) return;
    const plate = result.plates[i];
    const shown = [...(swapped[slot] ?? []), ...plate.slots.filter((s) => s.slot === slot).map((s) => s.component.id)];
    const r = await post<{ plate: PlateView | null }>('/api/v1/plates/swap', { ...scene(), plate_key: plate.plate_key, slot, shown_for_slot: shown });
    if (!r) return;
    if (!r.plate) return setNotice(t('plate.swap.none'));
    const next = r.plate;
    setResult({ ...result, plates: result.plates.map((p, j) => (j === i ? next : p)) });
    setSwapped({ ...swapped, [slot]: shown });
  }

  function applyFilters(next: Filters) {
    setFilters(next);
    sheet.current?.close();
    if (result) void pick(deckSize, next);
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
  const on = activeFilters(filters);

  return (
    <>
      <header className="flex min-h-14 items-center justify-between gap-2">
        <span className="type-title-l">{C.APP_NAME}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => sheet.current?.showModal()}
            aria-label={on ? t('home.filters.on', { count: on }) : t('home.cta.filters')}
            className="inline-flex min-h-12 items-center gap-1 rounded-pill border-2 border-ink bg-surface px-3 type-label"
          >
            <SlidersIcon size={18} />
            <span className="max-sm:sr-only">{t('home.cta.filters')}</span>
            {!!on && <span className="rounded-pill bg-ink px-2 text-cream">{on}</span>}
          </button>
          <span className="inline-flex min-h-12 items-center gap-1 rounded-pill border-2 border-ink bg-surface px-3 type-label">
            {t('areas.lagos')}
            <CaretIcon size={16} />
          </span>
        </div>
      </header>
      <FiltersSheet dialog={sheet} filters={filters} onApply={applyFilters} />

      {greeting}

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
      {cooking && (
        <button
          type="button"
          onClick={() => {
            setHouseOpens(houseOpens + 1);
            houseSheet.current?.showModal();
          }}
          className="mt-6 flex min-h-14 w-full items-center gap-3 rounded-lg border-2 border-ink bg-surface px-4 text-left type-label"
        >
          <HouseIcon />
          <span className="flex-1">{inKitchen ? t('home.house.summary', { items: houseNames(kitchen, house).join(', ') }) : t('home.house.empty')}</span>
          <ChevronIcon />
        </button>
      )}
      <dialog
        ref={houseSheet}
        aria-labelledby="house-title"
        className="mx-auto mb-0 mt-auto max-h-[85dvh] w-full max-w-app rounded-t-xl border-2 border-ink bg-surface p-5 text-ink backdrop:bg-overlay"
      >
        {/* Keyed per opening, so the sheet's first-look choices (basics folded or not) are made fresh each time. */}
        <HouseSheet
          key={houseOpens}
          options={house}
          kitchen={kitchen}
          onShow={() => {
            houseSheet.current?.close();
            void pick(C.DECK_SIZE);
          }}
        />
      </dialog>
      {children}

      <section ref={answer} aria-live="polite" className="mt-6 grid scroll-mt-4 gap-4">
        {slow && <p className="text-ink-2">{t('reveal.slow')}</p>}
        {failed && <p className="text-scotch">{t('error.generic')}</p>}
        {result && (
          <Results
            result={result}
            budget={budget}
            people={people}
            peopleLabel={peopleLabel}
            inKitchen={inKitchen}
            onNotThis={replace}
            onSwap={swap}
            busy={busy}
          />
        )}
        {notice && <p className="text-ink-2">{notice}</p>}
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

// S-007: meal time, plate type, time, spice and vegetarian (doc 02). Edits stay in the sheet until Apply.
// shortcut: no region chips, avoid list or live plate count yet; they come with profiles and a count endpoint.
function FiltersSheet({ dialog, filters, onApply }: { dialog: React.RefObject<HTMLDialogElement | null>; filters: Filters; onApply: (f: Filters) => void }) {
  const t = useTranslations('filters');
  const t2 = useTranslations();
  const [draft, setDraft] = useState<Filters>(filters);
  const chip = (active: boolean) => `min-h-12 rounded-pill border-2 px-4 type-label ${active ? 'border-ink bg-palm-100' : 'border-ink-3 bg-surface'}`;
  const option = (label: string, active: boolean, set: () => void) => (
    <button key={label} type="button" aria-pressed={active} onClick={set} className={chip(active)}>
      {label}
    </button>
  );
  const group = (title: string, body: ReactNode) => (
    <fieldset className="mt-5">
      <legend className="type-label">{title}</legend>
      <div className="mt-2 flex flex-wrap gap-2">{body}</div>
    </fieldset>
  );
  return (
    <dialog
      ref={dialog}
      aria-labelledby="filters-title"
      onClose={() => setDraft(filters)}
      className="mx-auto mb-0 mt-auto max-h-[85dvh] w-full max-w-app rounded-t-xl border-2 border-ink bg-surface p-5 text-ink backdrop:bg-overlay"
    >
      <div className="flex items-center justify-between">
        <h2 id="filters-title" className="type-title-l">
          {t('title')}
        </h2>
        <form method="dialog">
          <button className="min-h-12 px-3 type-label underline">{t('close')}</button>
        </form>
      </div>
      {group(t('mealTitle'), [
        option(t('mealNow'), !draft.meal_time, () => setDraft({ ...draft, meal_time: null })),
        ...MEALS.map((m) => option(t(`meals.${m}`), draft.meal_time === m, () => setDraft({ ...draft, meal_time: m }))),
      ])}
      {group(
        t('typeTitle'),
        PLATE_TYPES.map((k) =>
          option(t(`types.${k}`), draft.plate_types.includes(k), () =>
            setDraft({ ...draft, plate_types: draft.plate_types.includes(k) ? draft.plate_types.filter((x) => x !== k) : [...draft.plate_types, k] }),
          ),
        ),
      )}
      {group(t('timeTitle'), [
        option(t('any'), draft.max_total_minutes === null, () => setDraft({ ...draft, max_total_minutes: null })),
        ...TIMES.map((m) => option(t2('plate.why.time', { minutes: m }), draft.max_total_minutes === m, () => setDraft({ ...draft, max_total_minutes: m }))),
      ])}
      {group(t('spiceTitle'), [
        option(t('any'), draft.spice_max === null, () => setDraft({ ...draft, spice_max: null })),
        ...([0, 1, 2, 3] as const).map((s) => option(t(`spice.${s}`), draft.spice_max === s, () => setDraft({ ...draft, spice_max: s }))),
      ])}
      <label className="mt-5 flex min-h-12 items-center gap-3 type-label">
        <input type="checkbox" checked={draft.vegetarian} onChange={(e) => setDraft({ ...draft, vegetarian: e.target.checked })} className="size-6" />
        {t('vegetarian')}
      </label>
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={() => setDraft(NO_FILTERS)} className="min-h-12 flex-1 rounded-pill border-2 border-ink bg-surface type-label">
          {t('reset')}
        </button>
        <button type="button" onClick={() => onApply(draft)} className="min-h-12 flex-1 rounded-pill border-2 border-ink bg-palm type-label">
          {t('apply')}
        </button>
      </div>
    </dialog>
  );
}

function Results({
  result,
  budget,
  people,
  peopleLabel,
  inKitchen,
  onNotThis,
  onSwap,
  busy,
}: {
  result: Result;
  budget: number;
  people: number;
  peopleLabel: string;
  inKitchen: boolean;
  onNotThis: (i: number) => void;
  onSwap: (i: number, slot: string) => void;
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
          <p className="type-caption text-ink-2">
            {t('plate.basis._', { budget: formatNaira(budget), people: peopleLabel })}
            {inKitchen && ` · ${t('plate.basis.house')}`}
          </p>
        </div>
      )}
      {result.plates.map((p, i) => (
        <PlateCard
          key={p.plate_key}
          plate={p}
          budget={budget}
          people={people}
          peopleLabel={peopleLabel}
          tight={result.state === 'tight'}
          first={i === 0}
          onNotThis={() => onNotThis(i)}
          onSwap={(slot) => onSwap(i, slot)}
          busy={busy}
        />
      ))}
    </>
  );
}

function PlateCard({
  plate: p,
  budget,
  people,
  peopleLabel,
  tight,
  first,
  onNotThis,
  onSwap,
  busy,
}: {
  plate: PlateView;
  budget: number;
  people: number;
  peopleLabel: string;
  tight: boolean;
  first: boolean;
  onNotThis: () => void;
  onSwap: (slot: string) => void;
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
  const sheetProps: SheetProps = { low: price.low_ngn, high: price.high_ngn, people: peopleLabel, count: price.source_count, receipt: price.receipt };
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
        <PriceSheet {...sheetProps} className="min-h-12">
          {meta}
        </PriceSheet>{' '}
        · {t('plate.why.time', { minutes: p.total_minutes })}
      </p>
      {first && C.PRICE_FIRST_NOTE_ENABLED && <FirstPriceNote sheet={sheetProps} />}
      {tight ? (
        <p className="mt-1 type-label text-amber">{t('deck.tight.gap', { amount: formatNaira(price.gap_ngn) })}</p>
      ) : price.stretch ? (
        <p className="mt-1 type-label text-amber">{t('plate.badge.over')}</p>
      ) : (
        spare >= 0 && <p className="mt-1 type-label text-ugu">{t('plate.why.fits', { budget: formatNaira(budget), spare: formatNaira(spare) })}</p>
      )}
      {!!p.uses_house.length && (
        <p className="mt-1 type-label text-ugu">
          {p.uses_cooked ? t('plate.why.house.cooked', { component: p.uses_house[0] }) : t('plate.why.house.items', { items: p.uses_house.join(', ') })} ·{' '}
          {t('plate.why.house.buy', { amount: formatNaira(Math.round((price.low_ngn + price.high_ngn) / 2 / C.PRICE_ROUNDING_NGN) * C.PRICE_ROUNDING_NGN) })}
        </p>
      )}
      <ul className="mt-3 grid gap-2">
        {p.slots.map((s) => (
          <li key={`${s.slot}-${s.component.id}`} className="flex items-center justify-between gap-3 border-t border-line pt-2">
            <span>{s.component.name}</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => onSwap(s.slot)}
              aria-label={t('plate.swap.label', { component: s.component.name })}
              className="min-h-12 shrink-0 rounded-pill border-2 border-ink bg-surface px-4 type-label disabled:opacity-60"
            >
              {t('plate.swap._')}
            </button>
          </li>
        ))}
      </ul>
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

// The first price a device ever sees gets one quiet note (doc 02, S-003; doc 11, section 6). It never blocks a tap.
function FirstPriceNote({ sheet }: { sheet: SheetProps }) {
  const t = useTranslations('prices.firstNote');
  // Cards only appear after a tap, never in the server render, so reading localStorage here can't break hydration.
  const [show, setShow] = useState(() => {
    try {
      return !localStorage.getItem(NOTE_KEY);
    } catch {
      return false;
    }
  });
  if (!show) return null;
  const done = () => {
    setShow(false);
    try {
      localStorage.setItem(NOTE_KEY, '1');
    } catch {
      // Private browsing: the note simply shows again next time.
    }
  };
  return (
    <div className="mt-2 rounded-md bg-sunken p-3 type-caption">
      <p>{t('body')}</p>
      <div className="mt-2 flex gap-4">
        <button type="button" onClick={done} className="min-h-12 type-label underline">
          {t('ok')}
        </button>
        <PriceSheet {...sheet} className="min-h-12 type-label">
          {t('more')}
        </PriceSheet>
      </div>
    </div>
  );
}

const houseNames = (k: Kitchen, o: HouseOptions) => {
  const name = (list: { id: string; name: string }[], id: string) => list.find((x) => x.id === id)?.name ?? id;
  return [...k.cooked.map((c) => name(o.cooked, c.id)), ...k.foodstuff.map((id) => name(o.foodstuff, id)), ...k.basic.map((id) => name(o.basic, id))];
};
const FOODSTUFF_SHOWN = 10;

// S-024 What's in the house? Every tap saves at once, on this phone. Cooked food carries its day ("today", "from Sunday").
// shortcut: no "Anything else?" text (it needs the AI parser, M3), no "Other soup or stew" search, no live preview.
function HouseSheet({ options, kitchen, onShow }: { options: HouseOptions; kitchen: Kitchen; onShow: () => void }) {
  const t = useTranslations('house');
  const [allFood, setAllFood] = useState(false);
  // Basics collapse once some are chosen, decided when the sheet opens so it never folds away mid-tap.
  const [basicsOpen] = useState(!kitchen.basic.length);
  const now = today();
  const chip = (active: boolean) => `min-h-12 rounded-pill border-2 px-4 type-label ${active ? 'border-ink bg-palm-100' : 'border-ink-3 bg-surface'}`;
  const toggle = (group: 'foodstuff' | 'basic', id: string) =>
    saveKitchen({ ...kitchen, [group]: kitchen[group].includes(id) ? kitchen[group].filter((x) => x !== id) : [...kitchen[group], id] });
  const toggleCooked = (id: string) =>
    saveKitchen({
      ...kitchen,
      cooked: kitchen.cooked.some((c) => c.id === id) ? kitchen.cooked.filter((c) => c.id !== id) : [...kitchen.cooked, { id, at: now }],
    });
  const age = (at: string) =>
    at === now ? t('cooked.age.today') : t('cooked.age.from', { day: new Intl.DateTimeFormat('en-NG', { weekday: 'long' }).format(new Date(at)) });
  const items = (list: { id: string; name: string }[], group: 'foodstuff' | 'basic') =>
    list.map((i) => (
      <button
        key={i.id}
        type="button"
        aria-pressed={kitchen[group].includes(i.id)}
        onClick={() => toggle(group, i.id)}
        className={chip(kitchen[group].includes(i.id))}
      >
        {i.name}
      </button>
    ));
  return (
    <>
      <div className="flex items-center justify-between">
        <h2 id="house-title" className="type-title-l">
          {t('title')}
        </h2>
        <form method="dialog">
          <button className="min-h-12 px-3 type-label underline">{t('close')}</button>
        </form>
      </div>
      <p className="text-ink-2">{t('subtitle')}</p>
      {!!options.cooked.length && (
        <fieldset className="mt-5">
          <legend className="type-label">{t('group.cooked')}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {options.cooked.map((c) => {
              const have = kitchen.cooked.find((k) => k.id === c.id);
              return (
                <button key={c.id} type="button" aria-pressed={!!have} onClick={() => toggleCooked(c.id)} className={chip(!!have)}>
                  {c.name}
                  {have && <span className="text-ink-2"> · {age(have.at)}</span>}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      <fieldset className="mt-5">
        <legend className="type-label">{t('group.foodstuff')}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {items(allFood ? options.foodstuff : options.foodstuff.slice(0, FOODSTUFF_SHOWN), 'foodstuff')}
          {!allFood && options.foodstuff.length > FOODSTUFF_SHOWN && (
            <button type="button" onClick={() => setAllFood(true)} className="min-h-12 px-3 type-label underline">
              {t('more')}
            </button>
          )}
        </div>
      </fieldset>
      <details open={basicsOpen} className="mt-5">
        <summary className="min-h-12 cursor-pointer py-3 type-label">
          {kitchen.basic.length ? t('basic.collapsed', { count: kitchen.basic.length }) : t('group.basic')}
        </summary>
        <div className="mt-2 flex flex-wrap gap-2">{items(options.basic, 'basic')}</div>
      </details>
      <div className="mt-6 grid gap-2">
        <button type="button" onClick={onShow} className="min-h-14 rounded-pill border-2 border-ink bg-palm type-title-m">
          {t('cta')}
        </button>
        <button type="button" onClick={() => saveKitchen(EMPTY_KITCHEN)} className="min-h-12 type-label underline">
          {t('clear')}
        </button>
      </div>
    </>
  );
}
