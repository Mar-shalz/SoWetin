'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Frame, type FramePrice } from '@/components/cook/frame';
import { lagosToday, saveKitchen, useKitchen } from '@/components/decide/kitchen';
import { SaveButton } from '@/components/plate/save-button';
import { IngredientName } from '@/components/plate/swaps';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { HISTORY, MAX_ITEMS, NO_PLATES, parsePlates, store, useStored } from '@/lib/device/store';
import { roundAmount, stepText } from '@/lib/plates/step-text';
import { cookServings } from '@/lib/pricing/costPlate';

export type CookStep = { text: string; cue: string | null; heat: 'low' | 'medium' | 'high' | null; timer_seconds: number | null };
export type CookLine = { id: string; name: string; qtyPerServing: number | null; unit: string };
export type CookComponent = { id: string; name: string; batchServingsMin: number; lines: CookLine[]; steps: CookStep[] };
type Screen = { kind: 'step'; c: CookComponent; step: CookStep } | { kind: 'divider'; done: string; next: string } | { kind: 'finish' };
type Timer = { id: string; name: string; endsAt: number };
const TICK_MS = 1000;
const SWIPE_PX = 60; // a deliberate sideways swipe, not a wobble while scrolling

const noop = () => () => {};
const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// S-005 Cook mode (doc 02): one step per screen, swipe or Next (M-16), progress dots, a servings stepper that changes
// every amount, the ingredients in a drawer, timers that keep running across steps and components, the screen kept on
// (FR-021), then "Done? How did it go?" with Save, Ate it and the pot offer (BR-28).
// shortcut: Ate it and the price question aren't sent anywhere yet; events need consent and profiles (M3).
export function CookMode({
  components,
  back,
  people: firstPeople,
  start,
  pot,
  plateKey,
  title,
  price,
  fonts,
}: {
  components: CookComponent[];
  back: string;
  people: number;
  start?: string;
  pot: { id: string; name: string } | null;
  plateKey: string;
  title: string;
  price: FramePrice;
  fonts: { display: string; body: string };
}) {
  const t = useTranslations('cook');
  const t2 = useTranslations();
  const router = useRouter();
  const kitchen = useKitchen();
  const history = useStored(HISTORY, parsePlates, NO_PLATES);
  const screens: Screen[] = components.flatMap((c, i): Screen[] => [
    ...(i ? [{ kind: 'divider' as const, done: components[i - 1].name, next: c.name }] : []),
    ...c.steps.map((step) => ({ kind: 'step' as const, c, step })),
  ]);
  screens.push({ kind: 'finish' });
  const steps = screens.filter((s) => s.kind === 'step').length;
  const [people, setPeople] = useState(firstPeople);
  // "Cook with me" on a dish opens cook mode at that dish's first step.
  const [at, setAt] = useState(() => Math.max(0, screens.findIndex((s) => s.kind === 'step' && s.c.id === start)));
  const [timers, setTimers] = useState<Timer[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [done, setDone] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [framing, setFraming] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const canLock = useSyncExternalStore(
    noop,
    () => 'wakeLock' in navigator,
    () => true,
  );

  // Keep the screen on while cooking; the lock drops when the tab hides, so take it again on return.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const take = () => {
      if (document.visibilityState === 'visible')
        navigator.wakeLock?.request('screen').then(
          (l) => (lock = l),
          () => {},
        );
    };
    take();
    document.addEventListener('visibilitychange', take);
    return () => {
      document.removeEventListener('visibilitychange', take);
      void lock?.release();
    };
  }, []);

  // Timers run on end times, so they stay right after switching apps; finished ones buzz and show a banner.
  useEffect(() => {
    if (!timers.length) return;
    const id = setInterval(() => {
      const t0 = Date.now();
      setNow(t0);
      const over = timers.filter((x) => x.endsAt <= t0);
      if (over.length) {
        navigator.vibrate?.([300, 150, 300]);
        setDone(over[0].name);
        setTimers(timers.filter((x) => x.endsAt > t0));
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [timers]);

  const screen = screens[at];
  const stepNo = screens.slice(0, at + 1).filter((s) => s.kind === 'step').length;
  const servings = (c: CookComponent) => cookServings({ id: c.id, batchServingsMin: c.batchServingsMin, lines: [] }, people);
  const amount = (c: CookComponent, l: CookLine) => (l.qtyPerServing === null ? null : `${roundAmount(l.qtyPerServing * servings(c))} ${l.unit}`);
  const live = (c: CookComponent) => (id: string) => {
    const l = c.lines.find((x) => x.id === id);
    return l ? [amount(c, l), l.name].filter(Boolean).join(' ') : null;
  };
  const go = (to: number) => {
    setAt(Math.min(screens.length - 1, Math.max(0, to)));
    setDone(null);
  };
  const startTimer = (step: CookStep, component: string) =>
    setTimers([...timers, { id: `${component}-${step.text}`, name: step.text.split(/[.,]/)[0], endsAt: Date.now() + step.timer_seconds! * 1000 }]);
  const finish = (addPot: boolean) => {
    store(HISTORY, [{ key: plateKey, title, people, at: new Date().toISOString() }, ...history].slice(0, MAX_ITEMS));
    if (addPot && pot) saveKitchen({ ...kitchen, cooked: [...kitchen.cooked.filter((c) => c.id !== pot.id), { id: pot.id, at: lagosToday() }] });
    // S-029 follows "Ate it" once per plate (F30).
    setFraming(true);
  };

  if (framing)
    return (
      <main className="mx-auto flex min-h-dvh max-w-app flex-col gap-4 px-4 py-4">
        <Frame plate={title} price={price} fonts={fonts} onDone={() => router.push('/')} />
      </main>
    );

  const round = 'grid size-12 place-items-center rounded-pill border-2 border-ink bg-surface type-title-m disabled:opacity-40';
  return (
    <main className="mx-auto flex min-h-dvh max-w-app flex-col gap-4 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button type="button" disabled={people <= C.PEOPLE_MIN} onClick={() => setPeople(people - 1)} aria-label={t2('detail.people.fewer')} className={round}>
            −
          </button>
          <span className="min-w-20 text-center type-label" aria-live="polite">
            {t2('home.sentence.people', { count: people })}
          </span>
          <button type="button" disabled={people >= C.PEOPLE_MAX} onClick={() => setPeople(people + 1)} aria-label={t2('detail.people.more')} className={round}>
            +
          </button>
        </div>
        <button type="button" onClick={() => drawer.current?.showModal()} className="min-h-12 rounded-pill border-2 border-ink bg-surface px-4 type-label">
          {t('ingredients')}
        </button>
        <Link href={`${back}?people=${people}`} className="flex min-h-12 items-center px-2 type-label underline">
          {t('close')}
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <ol aria-hidden className="flex flex-1 flex-wrap gap-1">
          {Array.from({ length: steps }, (_, i) => (
            <li key={i} className={`size-2 rounded-pill ${i < stepNo ? 'bg-ink' : 'bg-line'}`} />
          ))}
        </ol>
        <p className="type-label text-ink-2">{screen.kind === 'step' ? t('step', { n: stepNo, total: steps }) : ''}</p>
      </div>
      {!canLock && <p className="type-caption text-ink-2">{t('screenOn')}</p>}
      {!!timers.length && (
        <ul className="grid gap-1 rounded-md bg-ink p-3 text-cream" aria-live="polite">
          {timers.map((x) => (
            <li key={x.id} className="type-label">
              {t('timer.left', { name: x.name, time: clock(x.endsAt - now) })}
            </li>
          ))}
        </ul>
      )}
      {done && (
        <p role="alert" className="rounded-md bg-egusi p-3 type-title-m">
          {t('timer.done', { stepName: done })}
        </p>
      )}

      <section
        className="flex flex-1 flex-col justify-center"
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const from = touch.current;
          touch.current = null;
          if (!from || screen.kind === 'finish') return;
          const dx = e.changedTouches[0].clientX - from.x;
          if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(e.changedTouches[0].clientY - from.y)) go(at + (dx < 0 ? 1 : -1));
        }}
      >
        <div key={at} className="sw-step flex flex-col gap-4">
          {screen.kind === 'step' && (
            <>
              <p className="type-label text-ink-2">{screen.c.name}</p>
              <p className="type-display-l">{stepText(screen.step.text, live(screen.c))}</p>
              {screen.step.heat && <p className="type-title-m">{t2(`recipe.heat.${screen.step.heat}`)}</p>}
              {screen.step.cue && <p className="type-body-l text-ink-2">{screen.step.cue}</p>}
              {screen.step.timer_seconds && (
                <button
                  type="button"
                  onClick={() => startTimer(screen.step, screen.c.name)}
                  className="min-h-14 self-start rounded-pill border-2 border-ink bg-surface px-5 type-label"
                >
                  {t('timer.start', { minutes: Math.round(screen.step.timer_seconds / 60) })}
                </button>
              )}
            </>
          )}
          {screen.kind === 'divider' && <p className="type-display-l">{t('divider', { done: screen.done, next: screen.next })}</p>}
          {screen.kind === 'finish' && (
            <>
              <h1 className="type-display-l">{t('finish.title')}</h1>
              <SaveButton plateKey={plateKey} title={title} people={people} />
              {asking && pot ? (
                <>
                  <p className="type-title-m">{t('finish.pot._', { component: pot.name })}</p>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => finish(true)} className="min-h-14 flex-1 rounded-pill border-2 border-ink bg-palm type-title-m">
                      {t('finish.pot.add')}
                    </button>
                    <button type="button" onClick={() => finish(false)} className="min-h-14 flex-1 rounded-pill border-2 border-ink bg-surface type-title-m">
                      {t('finish.pot.no')}
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => (pot ? setAsking(true) : finish(false))}
                  className="min-h-14 rounded-pill border-2 border-ink bg-palm type-title-m"
                >
                  {t('finish.ateIt')}
                </button>
              )}
            </>
          )}
        </div>
      </section>

      {screen.kind !== 'finish' && (
        <div className="sticky bottom-0 flex gap-3 bg-cream py-3">
          <button
            type="button"
            disabled={at === 0}
            onClick={() => go(at - 1)}
            className="min-h-14 flex-1 rounded-pill border-2 border-ink bg-surface type-title-m disabled:opacity-40"
          >
            {t('back')}
          </button>
          <button type="button" onClick={() => go(at + 1)} className="min-h-14 flex-[2] rounded-pill border-2 border-ink bg-palm type-title-m">
            {t('next')}
          </button>
        </div>
      )}

      <dialog
        ref={drawer}
        aria-labelledby="cook-ingredients"
        className="mx-auto mb-0 mt-auto max-h-[85dvh] w-full max-w-app rounded-t-xl border-2 border-ink bg-surface p-5 text-ink backdrop:bg-overlay"
      >
        <div className="flex items-center justify-between">
          <h2 id="cook-ingredients" className="type-title-l">
            {t('ingredients')}
          </h2>
          <form method="dialog">
            <button className="min-h-12 px-3 type-label underline">{t('close')}</button>
          </form>
        </div>
        {components.map((c) => (
          <section key={c.id} className="mt-4">
            <h3 className="type-title-m">{c.name}</h3>
            <p className="type-caption text-ink-2">{t2('recipe.ingredients', { people: servings(c) })}</p>
            <ul className="mt-1 grid gap-1">
              {c.lines.map((l) => (
                <li key={l.id}>
                  <IngredientName component={c.id} id={l.id} name={l.name} />
                  {amount(c, l) && <span className="text-ink-2"> {amount(c, l)}</span>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </dialog>
    </main>
  );
}
