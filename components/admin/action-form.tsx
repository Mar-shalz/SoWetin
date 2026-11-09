'use client';

import { useActionState, type ReactNode } from 'react';

export type Msg = { ok?: string; error?: string } | null;

// A form that runs a server action and shows its one-line result. Inputs come in as children from the server page.
export function ActionForm({
  action,
  submit,
  pending,
  children,
  quiet,
  className,
}: {
  action: (state: Msg, form: FormData) => Promise<Msg>;
  submit: string;
  pending: string;
  children?: ReactNode;
  quiet?: boolean;
  className?: string;
}) {
  const [msg, run, busy] = useActionState(action, null);
  return (
    <form action={run} className={className}>
      {children}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className={`min-h-12 rounded-pill border-2 border-ink px-5 type-label disabled:opacity-60 ${quiet ? 'bg-surface' : 'bg-palm'}`}
        >
          {busy ? pending : submit}
        </button>
        <p aria-live="polite" className={msg?.error ? 'text-scotch' : 'text-ugu'}>
          {msg?.error ?? msg?.ok}
        </p>
      </div>
    </form>
  );
}
