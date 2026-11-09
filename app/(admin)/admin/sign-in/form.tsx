'use client';

import { useActionState } from 'react';
import { Input } from '@/components/admin/fields';
import { signIn, type SignInState } from '../actions';

// Email and password, then the authenticator code on the next page.
export function SignInForm({ l }: { l: Record<'email' | 'password' | 'submit' | 'submitting', string> }) {
  const [s, run, busy] = useActionState<SignInState, FormData>(signIn, {});
  return (
    <form action={run} className="mt-6 grid gap-4">
      <Input label={l.email} name="email" type="email" required autoComplete="email" />
      <Input label={l.password} name="password" type="password" required autoComplete="current-password" />
      <button disabled={busy} className="min-h-12 rounded-pill border-2 border-ink bg-palm px-5 type-label disabled:opacity-60">
        {busy ? l.submitting : l.submit}
      </button>
      {s.error && (
        <p role="alert" className="text-scotch">
          {s.error}
        </p>
      )}
    </form>
  );
}
