'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Frame, type FramePrice } from '@/components/cook/frame';
import { lagosToday, saveKitchen, useKitchen } from '@/components/decide/kitchen';
import { HISTORY, MAX_ITEMS, NO_PLATES, parsePlates, store, useStored } from '@/lib/device/store';

export type CookStep = { text: string; cue: string | null; heat: 'low' | 'medium' | 'high' | null; timer_seconds: number | null };
export type CookComponent = { id: string; name: string; steps: CookStep[] };
type Screen = { kind: 'step'; component: string; step: CookStep; n: number } | { kind: 'divider'; done: string; next: string } | { kind: 'finish' };
type Timer = { id: string; name: string; endsAt: number };
const TICK_MS = 1000;

const noop = () => () => {};
const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// S-005 Cook mode (doc 02): one step per screen, big type, timers that keep running across steps and components,
// the screen kept on (FR-021), then "Done? How did it go?" with the pot offer (BR-28).
// shortcut: no swipe, servings stepper, ingredient drawer, Ate it logging or offline yet (events and PWA come later).
export function CookMode({
  components,
  back,
  pot,
  plateKey,
  title,
  price,
  fonts,
}: {
  components: CookComponent[];
  back: string;
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
    ...c.steps.map((step, n) => ({ kind: 'step' as const, component: c.name, step, n })),
  ]);
  screens.push({ kind: 'finish' });
  const steps = screens.filter((s) => s.kind === 'step').length;
  const [at, setAt] = useState(0);
  const [timers, setTimers] = useState<Timer[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [done, setDone] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [framing, setFraming] = useState(false);
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
  const start = (step: CookStep, component: string) =>
    setTimers([...timers, { id: `${component}-${step.text}`, name: step.text.split(/[.,]/)[0], endsAt: Date.now() + step.timer_seconds! * 1000 }]);
  const finish = (addPot: boolean) => {
    store(HISTORY, [{ key: plateKey, title, at: new Date().toISOString() }, ...history].slice(0, MAX_ITEMS));
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

  return (
    <main className="mx-auto flex min-h-dvh max-w-app flex-col gap-4 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="type-label text-ink-2">{screen.kind === 'step' ? t('step', { n: stepNo, total: steps }) : ''}</p>
        <Link href={back} className="flex min-h-12 items-center px-3 type-label underline">
          {t('close')}
        </Link>
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

      <section className="flex flex-1 flex-col justify-center gap-4">
        {screen.kind === 'step' && (
          <>
            <p className="type-label text-ink-2">{screen.component}</p>
            <p className="type-display-l">{screen.step.text}</p>
            {screen.step.heat && <p className="type-title-m">{t2(`recipe.heat.${screen.step.heat}`)}</p>}
            {screen.step.cue && <p className="type-body-l text-ink-2">{screen.step.cue}</p>}
            {screen.step.timer_seconds && (
              <button
                type="button"
                onClick={() => start(screen.step, screen.component)}
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
      </section>

      {screen.kind !== 'finish' && (
        <div className="sticky bottom-0 flex gap-3 bg-cream py-3">
          <button
            type="button"
            disabled={at === 0}
            onClick={() => {
              setAt(at - 1);
              setDone(null);
            }}
            className="min-h-14 flex-1 rounded-pill border-2 border-ink bg-surface type-title-m disabled:opacity-40"
          >
            {t('back')}
          </button>
          <button
            type="button"
            onClick={() => {
              setAt(at + 1);
              setDone(null);
            }}
            className="min-h-14 flex-[2] rounded-pill border-2 border-ink bg-palm type-title-m"
          >
            {t('next')}
          </button>
        </div>
      )}
    </main>
  );
}
