'use client';

import { useState } from 'react';

// "Copy list" (S-006): puts the market list text on the clipboard and says so.
export function CopyButton({ text, label, done }: { text: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard?.writeText(text).then(
          () => setCopied(true),
          () => setCopied(false),
        )
      }
      className="min-h-12 flex-1 rounded-pill border-2 border-ink bg-surface px-4 type-label"
      aria-live="polite"
    >
      {copied ? done : label}
    </button>
  );
}
