'use client';

import { useRef, useState } from 'react';
import { autofillNext, type AutofillStep } from '@/app/(admin)/admin/actions';
import { t } from '@/lib/admin/t';
import { APP_CONFIG as C } from '@/lib/config/app.config';

// D-39: runs "Fill and publish with AI" one dish at a time while this page stays open, pausing between dishes so the
// free AI tier isn't flooded. Stops on its own when every dish has been tried or the daily limit runs out.
export function Autofill() {
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<AutofillStep[]>([]);
  const [end, setEnd] = useState<AutofillStep['outcome'] | null>(null);
  const stop = useRef(false);
  async function run() {
    setRunning(true);
    setEnd(null);
    stop.current = false;
    const tried: string[] = [];
    while (!stop.current) {
      const step = await autofillNext(tried).catch((): AutofillStep => ({ outcome: 'failed' }));
      if (step.outcome === 'done' || step.outcome === 'quota' || step.outcome === 'not_configured' || !step.id) {
        setEnd(step.outcome);
        break;
      }
      tried.push(step.id);
      setLog((l) => [step, ...l]);
      await new Promise((r) => setTimeout(r, C.AUTOFILL_PAUSE_MS));
    }
    setRunning(false);
  }
  const published = log.filter((s) => s.outcome === 'published').length;
  return (
    <section className="mt-6 rounded-lg border border-line bg-surface p-5" aria-labelledby="autofill">
      <h2 id="autofill" className="type-title-m">
        {t('autofill.title')}
      </h2>
      <p className="mt-1 text-ink-2">{t('autofill.body')}</p>
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          disabled={running}
          onClick={run}
          className="min-h-12 rounded-pill border-2 border-ink bg-palm px-5 type-label disabled:opacity-60"
        >
          {running ? t('autofill.running') : t('autofill.start')}
        </button>
        {running && (
          <button type="button" onClick={() => (stop.current = true)} className="min-h-12 rounded-pill border-2 border-ink bg-surface px-5 type-label">
            {t('autofill.stop')}
          </button>
        )}
      </div>
      <p className="mt-3 type-label" aria-live="polite">
        {t('autofill.count', { published, tried: log.length })}
        {end && ` ${t(`autofill.end.${end}`)}`}
      </p>
      <ul className="mt-2 grid max-h-80 gap-1 overflow-y-auto type-caption">
        {log.map((s) => (
          <li key={s.id}>
            {s.outcome === 'blocked'
              ? t('autofill.blocked', { name: s.name ?? '', missing: (s.missing ?? []).join(', ') })
              : t(`autofill.${s.outcome === 'published' ? 'published' : 'failed'}`, { name: s.name ?? '' })}
          </li>
        ))}
      </ul>
    </section>
  );
}
