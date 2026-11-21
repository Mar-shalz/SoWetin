'use client';

import Link from 'next/link';
import { BackIcon } from '@/components/ui/icons';

// Goes back one page when there is one in this tab; a plain link home otherwise (and without JavaScript).
export function BackButton({ label }: { label: string }) {
  return (
    <Link
      href="/"
      aria-label={label}
      onClick={(e) => {
        if (window.history.length > 1) {
          e.preventDefault();
          window.history.back();
        }
      }}
      className="grid size-12 shrink-0 place-items-center rounded-pill border-2 border-ink bg-surface"
    >
      <BackIcon size={22} />
    </Link>
  );
}
