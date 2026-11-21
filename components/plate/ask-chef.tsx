'use client';

import { useTranslations } from 'next-intl';
import { NO_AUTOFILL } from '@/components/ui/no-autofill';
import { CloseButton } from '@/components/ui/close-button';
import { ChefHatIcon } from '@/components/ui/icons';
import { useRef, useState } from 'react';
import { setSwap, useSwaps } from '@/components/plate/swaps';
import { APP_CONFIG as C } from '@/lib/config/app.config';

// The English line shown under safety text when the app is in Pidgin (BR-114). Null in English.
export type ChefEnglish = { note: string; medical: string; allergy: string; allergens: Record<string, string> } | null;
type Sub = { replace: string; with: string; note: string; replace_name: string; with_name: string };
type Reply = { state: 'ok'; answer: string; declined: boolean; substitutions: Sub[]; new_allergens: string[] } | { state: 'busy' | 'quota' };

function Both({ text, en, className }: { text: string; en?: string | null; className?: string }) {
  return (
    <p className={className}>
      {text}
      {en && <span className="block">{en}</span>}
    </p>
  );
}

// S-019 Ask Chef: a bottom sheet for one dish. Free text up to CHEF_QUESTION_MAX_CHARS, the answer
// labelled "Chef tip · AI", swaps as chips that change this recipe for this visit, an allergy box when a swap adds an
// allergen, and the fixed Chef line under every answer. One floating button per page; a plate with several dishes
// switches dish inside the sheet's fixed header.
export function AskChef({ dishes, people, en }: { dishes: { id: string; name: string }[]; people: number; en: ChefEnglish }) {
  const t = useTranslations();
  const dialog = useRef<HTMLDialogElement>(null);
  const [cur, setCur] = useState(0);
  const { id: component, name: dish } = dishes[cur];
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [asked, setAsked] = useState('');
  const [reply, setReply] = useState<Reply | null>(null);
  const swaps = useSwaps()[component] ?? {};
  const label = (tag: string) => (t.has(`allergen.${tag}`) ? t(`allergen.${tag}`) : tag);

  async function ask(question: string) {
    const v = question.trim();
    if (!v || busy) return;
    setBusy(true);
    setReply(null);
    setAsked(v);
    try {
      const res = await fetch('/api/v1/chef', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ component_id: component, question: v, people }),
      });
      setReply(res.ok ? ((await res.json()) as Reply) : { state: 'busy' });
      setQ('');
    } catch {
      setReply({ state: 'busy' });
    } finally {
      setBusy(false);
    }
  }

  const pill = 'min-h-12 rounded-pill border-2 px-3.5 type-label';
  return (
    <>
      {/* Floats bottom right inside the app column; pointer-events pass through the empty part of the strip. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-app justify-end px-3.5 pb-[calc(max(env(safe-area-inset-bottom),0.875rem)+1.5rem)]">
        <button
          type="button"
          onClick={() => dialog.current?.showModal()}
          aria-label={t('detail.askChef')}
          className="pointer-events-auto flex min-h-14 items-center gap-2 rounded-pill border-2 border-ink bg-egusi py-1 pl-1 pr-3.5 shadow-button type-label"
        >
          <span className="grid size-12 place-items-center rounded-pill bg-surface">
            <ChefHatIcon size={26} />
          </span>
          <span aria-hidden="true">{t('detail.askChef')}</span>
        </button>
      </div>
      <dialog
        ref={dialog}
        aria-labelledby={`chef-${component}`}
        className="mx-auto mb-0 mt-auto max-h-[85dvh] w-full max-w-app overflow-hidden rounded-t-xl border-2 border-ink bg-surface p-0 text-ink backdrop:bg-overlay"
      >
        {/* Header stays put; only the body scrolls, so the field starts below the header and only slides under it on scroll. */}
        <div className="flex max-h-[85dvh] flex-col">
          <div className="shrink-0 border-b border-ink-3 px-3.5 pb-3 pt-3.5">
            <div className="flex items-center justify-between gap-3">
              <h2 id={`chef-${component}`} className="type-title-l">
                {dish}
              </h2>
              <CloseButton label={t('chef.close')} />
            </div>
            {dishes.length > 1 && (
              <div className="mt-2 flex gap-2 overflow-x-auto">
                {dishes.map((d, i) => (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={i === cur}
                    onClick={() => {
                      setCur(i);
                      setReply(null);
                      setAsked('');
                    }}
                    className={`${pill} shrink-0 ${i === cur ? 'border-ink bg-palm-100' : 'border-ink-3 bg-surface'}`}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="overflow-y-auto overscroll-contain px-3.5 pb-3.5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void ask(q);
              }}
              className="mt-3.5 flex gap-2"
            >
              <input
                {...NO_AUTOFILL}
                value={q}
                maxLength={C.CHEF_QUESTION_MAX_CHARS}
                onChange={(e) => setQ(e.target.value)}
                aria-label={t('chef.placeholder')}
                placeholder={t('chef.placeholder')}
                className="min-h-12 min-w-0 flex-1 rounded-md border border-ink-3 bg-sunken px-3 type-input"
              />
              <button
                disabled={!q.trim() || busy}
                className={`${pill} shrink-0 border-ink bg-palm disabled:border-ink-3 disabled:bg-sunken disabled:text-ink-3`}
              >
                {t('chef.send')}
              </button>
            </form>
            <div aria-live="polite" className="mt-3.5 grid gap-3">
              {busy && <p className="text-ink-2">{t('chef.thinking')}</p>}
              {reply?.state === 'busy' && <p>{t('chef.busy')}</p>}
              {reply?.state === 'quota' && <p>{t('ai.quota')}</p>}
              {reply?.state === 'ok' && (
                <article className="rounded-md bg-sunken p-3">
                  <p className="type-caption text-ink-2">{t('chef.label')}</p>
                  <p className="mt-1 type-label">{asked}</p>
                  {reply.declined && <Both className="mt-2" text={t('chef.medical')} en={en?.medical} />}
                  <p className="mt-2 whitespace-pre-line">{reply.answer}</p>
                  {!!reply.new_allergens.length && (
                    <div role="note" className="mt-3 rounded-md border-2 border-scotch bg-surface p-3">
                      <Both
                        text={t('chef.allergyWarning', { allergens: reply.new_allergens.map(label).join(', ') })}
                        en={en?.allergy.replace('{allergens}', reply.new_allergens.map((a) => en.allergens[a] ?? a).join(', '))}
                      />
                    </div>
                  )}
                  {!!reply.substitutions.length && (
                    <ul className="mt-3 grid gap-2">
                      {reply.substitutions.map((s) => {
                        const on = swaps[s.replace]?.with === s.with;
                        return (
                          <li key={`${s.replace}-${s.with}`}>
                            <button
                              type="button"
                              aria-pressed={on}
                              onClick={() => setSwap(component, s.replace, on ? null : { with: s.with, withName: s.with_name })}
                              className={`${pill} ${on ? 'border-ink bg-palm-100' : 'border-ink-3 bg-surface'}`}
                            >
                              {t('chef.swap.use', { with: s.with_name, replace: s.replace_name })}
                            </button>
                            {s.note && <p className="mt-1 type-caption text-ink-2">{s.note}</p>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <Both className="mt-3 type-caption text-ink-2" text={t('ai.note.chef')} en={en?.note} />
                </article>
              )}
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
