'use client';

import { useTranslations } from 'next-intl';
import { useId, useRef, type ReactNode } from 'react';
import { formatNaira } from '@/lib/i18n/money';
import type { Receipt } from '@/lib/plates/serve';

const day = (iso: string) => new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short' }).format(new Date(iso));

// S-023 "Where this price comes from" (doc 02): every price label opens it. Fixed copy only (doc 11, section 6).
// shortcut: no "Was the price about right?" yet, it needs the events endpoint; no "Read how we price" until S-021 exists.
export function PriceSheet({
  low,
  high,
  people,
  count,
  receipt,
  children,
  className,
}: {
  low: number;
  high: number;
  people: string;
  count: number;
  receipt: Receipt;
  children: ReactNode;
  className?: string;
}) {
  const t = useTranslations('prices');
  const t2 = useTranslations();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const k = receipt.kinds;
  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className={`text-left underline underline-offset-4 ${className ?? ''}`}>
        {children}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="mx-auto mb-0 mt-auto max-h-[85dvh] w-full max-w-app rounded-t-xl border-2 border-ink bg-surface p-5 text-ink backdrop:bg-overlay"
      >
        <h2 id={titleId} className="type-title-l">
          {t('sheet.title')}
        </h2>
        <p className="mt-3 type-price-l">{t2('plate.price.range', { low: formatNaira(low), high: formatNaira(high) })}</p>
        <p className="type-caption text-ink-2">{t('sheet.for', { people, area: t2('areas.lagos') })}</p>
        <p className="mt-4">{t('sheet.explainer')}</p>
        <p className="mt-4 type-label">{t('sheet.count', { count })}</p>
        <p className="type-caption text-ink-2">
          {t('sheet.kinds', { visits: k.market_check, reports: k.press_survey, stores: k.online_store, official: k.official_stats })}
        </p>
        {!!receipt.shown.length && (
          <ul className="mt-2 grid gap-1 type-caption">
            {receipt.shown.map((s) => (
              <li key={s.name}>
                {s.name} · {day(s.observed_on)}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4">{receipt.last_visit ? t('sheet.lastVisit', { date: day(receipt.last_visit) }) : t('sheet.noVisit')}</p>
        {!!receipt.wide_items.length && <p className="mt-2">{t('sheet.wide', { items: receipt.wide_items.join(', ') })}</p>}
        <p className="mt-4 rounded-md bg-sunken p-3">{t('disclaimer.full')}</p>
        <form method="dialog" className="mt-4">
          <button className="min-h-12 w-full rounded-pill border-2 border-ink bg-surface type-label">{t('sheet.close')}</button>
        </form>
      </dialog>
    </>
  );
}
