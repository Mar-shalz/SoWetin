'use client';

import { useActionState } from 'react';
import { Area } from '@/components/admin/fields';
import { importPrices, type ImportState } from './actions';

type Labels = Record<'file' | 'paste' | 'check' | 'checking' | 'publish' | 'publishing' | 'rows' | 'problems' | 'flagged', string>;

// Two steps, as doc 04 asks: check the sheet and read the report, then publish exactly what was checked.
export function ImportForm({ l }: { l: Labels }) {
  const [s, run, busy] = useActionState<ImportState, FormData>(importPrices, {});
  return (
    <div className="grid gap-4">
      <form action={run} className="grid gap-3">
        <label className="grid gap-1">
          <span className="type-label">{l.file}</span>
          <input type="file" name="file" accept=".csv,text/csv" className="min-h-12" />
        </label>
        <Area label={l.paste} name="csv" rows={4} />
        <button disabled={busy} className="min-h-12 justify-self-start rounded-pill border-2 border-ink bg-surface px-5 type-label disabled:opacity-60">
          {busy ? l.checking : l.check}
        </button>
      </form>
      {s.csv !== undefined && (
        <div className="grid gap-2 rounded-md bg-sunken p-4" aria-live="polite">
          <p className="type-label">{l.rows.replace('{n}', String(s.rows ?? 0))}</p>
          {!!s.problems?.length && (
            <>
              <p className="text-scotch">{l.problems}</p>
              <ul className="list-disc pl-6">
                {s.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </>
          )}
          {!!s.flagged?.length && (
            <>
              <p className="text-amber">{l.flagged}</p>
              <ul className="list-disc pl-6">
                {s.flagged.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </>
          )}
          {!!s.rows && (
            <form action={run}>
              <input type="hidden" name="csv" value={s.csv} />
              <input type="hidden" name="publish" value="1" />
              <button disabled={busy} className="min-h-12 rounded-pill border-2 border-ink bg-palm px-5 type-label disabled:opacity-60">
                {busy ? l.publishing : l.publish.replace('{n}', String(s.rows))}
              </button>
            </form>
          )}
        </div>
      )}
      <p aria-live="polite" className={s.error ? 'text-scotch' : 'text-ugu'}>
        {s.error ?? s.ok}
      </p>
    </div>
  );
}
