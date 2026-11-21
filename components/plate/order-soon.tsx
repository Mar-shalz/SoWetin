'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CloseButton } from '@/components/ui/close-button';

// Two ways to order the ingredients (bulk, or per unit like Chowdeck). Both open a "coming soon" sheet until ordering is built.
export function OrderSoon() {
  const t = useTranslations('orderSoon');
  const dialog = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<'bulk' | 'unit'>('bulk');
  const open = (k: 'bulk' | 'unit') => {
    setKind(k);
    dialog.current?.showModal();
  };
  const btn = 'min-h-12 flex-1 rounded-pill border-2 border-ink px-3 type-label';
  return (
    <>
      <div className="flex gap-3">
        <button type="button" onClick={() => open('unit')} className={`${btn} bg-surface`}>
          {t('unit')}
        </button>
        <button type="button" onClick={() => open('bulk')} className={`${btn} bg-palm-100 shadow-button`}>
          {t('bulk')}
        </button>
      </div>
      <dialog
        ref={dialog}
        aria-labelledby="order-soon-title"
        className="mx-auto mb-0 mt-auto max-h-[85dvh] w-full max-w-app rounded-t-xl border-2 border-ink bg-surface px-3.5 pb-3.5 pt-0 overscroll-contain backdrop:bg-ink/40"
      >
        <div className="sticky top-0 z-10 -mx-3.5 flex justify-end bg-surface px-3.5 py-2.5">
          <CloseButton label={t('close')} />
        </div>
        <div className="flex flex-col items-center gap-3 pb-3.5 text-center">
          <span className="flex size-20 items-center justify-center rounded-pill border-2 border-ink bg-palm-100 shadow-button" aria-hidden="true">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 8h14l-1 12H6L5 8Z" />
              <path d="M9 8a3 3 0 0 1 6 0" />
            </svg>
          </span>
          <p className="rounded-pill bg-ink px-3 py-1 type-caption text-cream">{t('badge')}</p>
          <h2 id="order-soon-title" className="type-title-l">
            {t(`${kind}Title`)}
          </h2>
          <p className="type-body-m text-ink-2">{t(`${kind}Body`)}</p>
          <form method="dialog" className="mt-2 w-full">
            <button className="min-h-12 w-full rounded-pill border-2 border-ink bg-palm-100 px-3.5 type-label shadow-button">{t('back')}</button>
          </form>
        </div>
      </dialog>
    </>
  );
}
