'use client';

import { useActionState } from 'react';
import { Input } from '@/components/admin/fields';
import { signIn, type SignInState } from '../actions';

// Step 1 emails a 6-digit code (doc 13: no passwords). Step 2 checks it, then the second factor follows.
export function SignInForm({ l }: { l: Record<'email' | 'send' | 'sending' | 'code' | 'verify' | 'verifying', string> }) {
  const [s, run, busy] = useActionState<SignInState, FormData>(signIn, {});
  const label = s.email ? (busy ? l.verifying : l.verify) : busy ? l.sending : l.send;
  return (
    <form action={run} className="mt-6 grid gap-4">
      {s.email ? (
        <>
          <p>{s.sent}</p>
          <input type="hidden" name="email" value={s.email} />
          <Input label={l.code} name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={10} />
        </>
      ) : (
        <Input label={l.email} name="email" type="email" required autoComplete="email" />
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
