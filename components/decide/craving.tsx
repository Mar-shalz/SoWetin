'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { setLanguage } from '@/app/(app)/actions';
import { CloseIcon, SearchIcon } from '@/components/ui/icons';
import type { Craving } from '@/lib/ai/craving';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { formatNaira } from '@/lib/i18n/money';

export type CravingReply = { craving: Craving; source: 'ai' | 'prepass'; labels: Record<string, string> };
// The craving in play, and what the sentence said before it changed money, people or mode, so × can put them back.
export type ActiveCraving = {
  c: Craving;
  labels: Record<string, string>;
  source: 'ai' | 'prepass';
  before: { budget: number; people: number; mode: 'cook' | 'buy' };
};
export type Chip = { id: string; label: string };
type T = ReturnType<typeof useTranslations>;

export const clampBudget = (n: number) => Math.min(C.BUDGET_MAX, Math.max(C.BUDGET_MIN, n));
export const clampPeople = (n: number) => Math.min(C.PEOPLE_MAX, Math.max(C.PEOPLE_MIN, n));
const ARRAYS = ['plate_types', 'include_components', 'exclude_components', 'boost_tags', 'avoid_tags'] as const;

// Every part of the reading as a chip the person can remove (S-008). Labels come from copy keys and catalogue names only.
export function chipsOf(a: ActiveCraving, t: T): Chip[] {
  const { c, labels } = a;
  const name = (id: string) => labels[id] ?? id;
  const tag = (k: string) => (t.has(`tag.${k}`) ? t(`tag.${k}`) : k.replace(/_/g, ' '));
  const out: Chip[] = [];
  if (c.budget_ngn) out.push({ id: 'budget_ngn', label: formatNaira(clampBudget(c.budget_ngn)) });
  if (c.people) out.push({ id: 'people', label: t('home.sentence.people', { count: clampPeople(c.people) }) });
  if (c.mode) out.push({ id: 'mode', label: t(`craving.clarify.${c.mode}`) });
  if (c.meal_time) out.push({ id: 'meal_time', label: t(`filters.meals.${c.meal_time}`) });
  for (const k of c.plate_types) out.push({ id: `plate_types:${k}`, label: t.has(`filters.types.${k}`) ? t(`filters.types.${k}`) : tag(k) });
  for (const id of c.include_components) out.push({ id: `include_components:${id}`, label: name(id) });
  for (const id of c.exclude_components) out.push({ id: `exclude_components:${id}`, label: t('craving.chip.without', { item: name(id) }) });
  for (const k of c.boost_tags) out.push({ id: `boost_tags:${k}`, label: tag(k) });
  for (const k of c.avoid_tags) out.push({ id: `avoid_tags:${k}`, label: t('craving.chip.not', { item: tag(k) }) });
  if (c.max_total_minutes) out.push({ id: 'max_total_minutes', label: t('plate.why.time', { minutes: c.max_total_minutes }) });
  if (c.spice_max !== null) out.push({ id: 'spice_max', label: t(`filters.spice.${c.spice_max}`) });
  if (c.vegetarian) out.push({ id: 'vegetarian', label: t('filters.vegetarian') });
  return out;
}

export function withoutChip(c: Craving, id: string): Craving {
  const [field, value] = id.split(':') as [string, string | undefined];
  if (value !== undefined && (ARRAYS as readonly string[]).includes(field)) {
    const f = field as (typeof ARRAYS)[number];
    return { ...c, [f]: c[f].filter((x) => x !== value) };
  }
  return { ...c, [field]: field === 'vegetarian' ? false : null };
}

// S-008 in a sheet (Victor, 10 November 2026): the home screen shows a "Craving something?" tile and the field opens here,
// so the page stays calm. The examples sit in the same frame as the field, and only while it's focused and empty.
export function CravingSheet({ text, setText, busy, onFind }: { text: string; setText: (s: string) => void; busy: boolean; onFind: (text: string) => void }) {
  const t = useTranslations();
  const [focused, setFocused] = useState(true);
  const run = (value: string) => {
    const v = value.trim();
    if (!v || busy) return;
    setText(v);
    onFind(v);
  };
  // Tapping an example mustn't blur the field first, or the examples would vanish under the finger.
  const keep = (e: { preventDefault: () => void }) => e.preventDefault();
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 id="craving-title" className="type-title-l">
          {t('craving.sheet.title')}
        </h2>
        <form method="dialog">
          <button className="min-h-12 px-3 type-label underline">{t('house.close')}</button>
        </form>
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border-2 border-ink bg-surface focus-within:border-focus focus-within:shadow-[0_0_0_1px_var(--color-focus)]">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            run(text);
          }}
          className="flex min-h-14 items-center gap-2 pl-4 pr-2"
        >
          <SearchIcon size={20} />
          <input
            autoFocus
            type="text"
            value={text}
            maxLength={C.CRAVING_MAX_CHARS}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-label={t('home.craving.placeholder')}
            placeholder={t('home.craving.placeholder')}
            enterKeyHint="search"
            className="sw-field min-h-12 min-w-0 flex-1 bg-transparent type-input placeholder:text-ink-3"
          />
          {!!text && (
            <button type="button" onClick={() => setText('')} aria-label={t('craving.clear')} className="grid size-10 shrink-0 place-items-center rounded-pill">
              <CloseIcon size={18} />
            </button>
          )}
          <button
            type="submit"
            disabled={!text.trim() || busy}
            className="min-h-12 shrink-0 rounded-pill border-2 border-ink bg-palm px-4 type-label disabled:border-ink-3 disabled:bg-sunken disabled:text-ink-3"
          >
            {t('craving.find')}
          </button>
        </form>
        {focused && !text && (
          <div className="sw-pop border-t-2 border-line px-4 pb-4 pt-3">
            <p className="type-caption text-ink-2">{t('craving.try')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {t('craving.examples')
                .split(' · ')
                .map((e) => (
                  <button
                    key={e}
                    type="button"
                    onPointerDown={keep}
                    onMouseDown={keep}
                    onClick={() => run(e)}
                    className="min-h-12 rounded-pill border-2 border-ink-3 bg-cream px-4 type-label"
                  >
                    {e}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
      {text.length >= C.CRAVING_COUNTER_FROM && (
        <p className="mt-1 text-right type-caption text-ink-2" aria-live="polite">
          {text.length}/{C.CRAVING_MAX_CHARS}
        </p>
      )}
    </>
  );
}

const SNOOZE_KEY = 'sw_pidgin_offer_until';
const snoozed = () => {
  try {
    return (localStorage.getItem(SNOOZE_KEY) ?? '') > new Date().toISOString();
  } catch {
    return false;
  }
};

// What the parser understood (S-008): removable chips, the cook-or-buy question as two chips, food found for the house
// (added only when tapped, BR-134), and the one-time Pidgin offer (BR-111).
export function CravingChips({
  active,
  cooking,
  have,
  onRemove,
  onMode,
  onAddHouse,
}: {
  active: ActiveCraving;
  cooking: boolean;
  have: string[];
  onRemove: (id: string) => void;
  onMode: (mode: 'cook' | 'buy') => void;
  onAddHouse: (id: string) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const chips = chipsOf(active, t);
  const found = [...active.c.have_cooked, ...active.c.have_ingredients].filter((id) => !have.includes(id));
  const [added, setAdded] = useState<string[]>([]);
  const [offer, setOffer] = useState(() => C.PIDGIN_ENABLED && active.c.language_detected === 'pcm' && locale === 'en-NG' && !snoozed());
  const snooze = () => {
    setOffer(false);
    try {
      localStorage.setItem(SNOOZE_KEY, new Date(Date.now() + C.PIDGIN_OFFER_SNOOZE_DAYS * 86_400_000).toISOString());
    } catch {
      // Private browsing: the offer may show again next time.
    }
  };
  const pill = 'inline-flex min-h-12 items-center gap-2 rounded-pill border-2 px-4 type-label';
  return (
    <div className="grid gap-3">
      {offer && (
        <div className="rounded-md bg-sunken p-3">
          <p>{t('pidgin.offer._')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <form action={setLanguage}>
              <button name="locale" value="pcm" className={`${pill} border-ink bg-palm`}>
                {t('pidgin.offer.yes')}
              </button>
            </form>
            <button type="button" onClick={snooze} className={`${pill} border-ink bg-surface`}>
              {t('pidgin.offer.no')}
            </button>
          </div>
        </div>
      )}
      {active.c.clarify === 'mode' && !active.c.mode && (
        <div className="flex flex-wrap gap-2">
          {(['cook', 'buy'] as const).map((m) => (
            <button key={m} type="button" onClick={() => onMode(m)} className={`${pill} border-ink bg-surface`}>
              {t(`craving.clarify.${m}`)}
            </button>
          ))}
        </div>
      )}
      {!!chips.length && (
        <div>
          <ul className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <li key={chip.id}>
                <span className={`${pill} border-ink bg-palm-100 pr-1`}>
                  {chip.label}
                  <button
                    type="button"
                    onClick={() => onRemove(chip.id)}
                    aria-label={t('craving.chip.remove', { chip: chip.label })}
                    className="grid size-10 place-items-center rounded-pill"
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 type-caption text-ink-2">{t('craving.understood')}</p>
          {active.source === 'ai' && <p className="mt-1 type-caption text-ink-2">{t('ai.note.craving')}</p>}
        </div>
      )}
      {cooking && !!found.length && (
        <div>
          <p className="type-label">{t('house.text.found')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {found.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  onAddHouse(id);
                  setAdded([...added, id]);
                }}
                className={`${pill} border-ink-3 bg-surface`}
              >
                + {active.labels[id] ?? id}
              </button>
            ))}
          </div>
        </div>
      )}
      {!!added.length && (
        <p className="type-caption text-ugu" aria-live="polite">
          {t('house.text.added', { items: added.map((id) => active.labels[id] ?? id).join(', ') })}
        </p>
      )}
    </div>
  );
}
