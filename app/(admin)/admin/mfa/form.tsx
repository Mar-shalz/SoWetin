'use client';

import { useActionState } from 'react';
import { Input } from '@/components/admin/fields';
import { mfa, type MfaState } from '../actions';

type Labels = Record<'start' | 'starting' | 'scan' | 'qrAlt' | 'secret' | 'code' | 'verify' | 'verifying', string>;

export function MfaForm({ factorId, l }: { factorId?: string; l: Labels }) {
  const [s, run, busy] = useActionState<MfaState, FormData>(mfa, { factorId });
  const label = s.factorId ? (busy ? l.verifying : l.verify) : busy ? l.starting : l.start;
  return (
    <form action={run} className="mt-6 grid gap-4">
      {s.qr && (
        <figure className="grid gap-2">
          <figcaption>{l.scan}</figcaption>
          {/* eslint-disable-next-line @next/next/no-img-element -- an SVG data URL made by Supabase, nothing to optimise */}
          <img src={s.qr} alt={l.qrAlt} width={200} height={200} className="rounded-md bg-surface p-2" />
          <p className="type-caption">
            {l.secret} <code className="break-all">{s.secret}</code>
          </p>
        </figure>
      )}
      {s.factorId && (
        <>
          <input type="hidden" name="factor" value={s.factorId} />
          <Input label={l.code} name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} />
        </>
      )}
      <button disabled={busy} className="min-h-12 rounded-pill border-2 border-ink bg-palm px-5 type-label disabled:opacity-60">
        {label}
      </button>
      {s.error && (
        <p role="alert" className="text-scotch">
          {s.error}
        </p>
      )}
    </form>
  );
}
