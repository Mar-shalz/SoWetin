'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { personaFor, type Persona, type Points } from '@/lib/engine/persona';
import { store } from '@/lib/device/store';
import { CopyIcon, DownloadIcon, ShareIcon } from '@/components/ui/icons';
import { CloseButton } from '@/components/ui/close-button';

export type GameCard = { id: string; name: string; picture: string | null };
// Doc 11, section 2: each personality's colour, from the design tokens.
const COLOUR: Record<Persona, string> = {
  swallow: 'enamel',
  pepper: 'palm',
  jollof: 'palm',
  street: 'egusi',
  explorer: 'ugu',
  comfort: 'egusi',
  breakfast: 'egusi',
  quick: 'enamel',
  everything: 'ugu',
  connoisseur: 'enamel',
};
const W = 1080;
const H = 1920;

// S-018 Teach me your taste: 12 cards, Yum or Nah by button or arrow keys, "Finish now" after TASTE_GAME_MIN_ANSWERS.
// S-028 Chop Personality: the card drawn on the phone, saved as an image, never with prices or a name (BR-152).
// shortcut: no swipe, stamp motion or taste signals yet; answers stay on this phone (accounts bring signals, M3).
export function Game({ cards, points, fonts }: { cards: GameCard[]; points: Record<string, Points>; fonts: { display: string; body: string } }) {
  const t = useTranslations('persona');
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const deck = cards;
  const [read, setRead] = useState<string | null | undefined>(undefined);
  const [linkCopied, setLinkCopied] = useState(false);
  const [done, setDone] = useState(false);
  const [igSaved, setIgSaved] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const sheet = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const answered = Object.keys(answers).length;
  const card = deck[answered];
  const persona = done || !card ? personaFor(answers, C, points) : null;

  const answer = (yum: boolean) => card && setAnswers({ ...answers, [card.id]: yum });
  useEffect(() => {
    if (persona) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') answer(true);
      if (e.key === 'ArrowLeft') answer(false);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  // Draw the story card once the personality is known; it is also what "Save my card" saves.
  useEffect(() => {
    if (!persona || !canvas.current) return;
    const ctx = canvas.current.getContext('2d')!;
    const css = getComputedStyle(document.documentElement);
    const colour = (n: string) => css.getPropertyValue(`--color-${n}`).trim() || '#1C1512';
    ctx.fillStyle = colour(COLOUR[persona]);
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = colour('cream');
    ctx.fillRect(60, 60, W - 120, H - 120);
    // The SoWetin mark and name at the top, so the card says where it's from wherever it travels.
    const logo = new window.Image();
    logo.onload = () => ctx.drawImage(logo, W / 2 - 60, 120, 120, 120);
    logo.src = '/icon.svg';
    ctx.fillStyle = colour('ink');
    ctx.textAlign = 'center';
    // Canvas font shorthand is weight, size, family, in that order.
    const text = (s: string, y: number, size: number, weight: number, family: string, max = W - 240) => {
      ctx.font = `${weight} ${size}px ${family}`;
      const words = s.split(' ');
      let line = '';
      for (const w of words) {
        if (ctx.measureText(`${line}${w}`).width > max && line) {
          ctx.fillText(line.trim(), W / 2, y);
          y += size * 1.25;
          line = '';
        }
        line += `${w} `;
      }
      ctx.fillText(line.trim(), W / 2, y);
      return y + size * 1.25;
    };
    text(C.APP_NAME, 300, 52, 800, fonts.display);
    let y = text(t('eyebrow'), 400, 48, 600, fonts.body);
    y = text(t(`${persona}.name`), y + 60, 120, 800, fonts.display);
    y = text(t(`${persona}.line`), y + 60, 52, 500, fonts.body);
    y = text(t(`${persona}.traits`), y + 80, 44, 700, fonts.body);
    text(t(`${persona}.dishes`), y + 80, 44, 500, fonts.body);
    text(t('card.cta'), H - 220, 44, 700, fonts.body);
    store('sw_persona', persona);
  }, [persona, t, fonts]);

  // The AI read (Victor, 10 November 2026). Our code decides the personality; the AI only describes it.
  useEffect(() => {
    if (!persona || read !== undefined) return;
    const ids = (yum: boolean) => Object.keys(answers).filter((id) => answers[id] === yum);
    fetch('/api/v1/persona', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ persona, yum: ids(true), nah: ids(false) }) })
      .then((r) => (r.ok ? r.json() : { line: null }))
      .then((r: { line: string | null }) => setRead(r.line))
      .catch(() => setRead(null));
  }, [persona, read, answers]);

  if (persona) {
    const link = `${window.location.origin}/play?d=${deck.map((c) => c.id).join('.')}&f=1`;
    const shareText = t('share.text', { name: t(`${persona}.name`), link });
    const blob = () => new Promise<Blob | null>((ok) => (canvas.current ? canvas.current.toBlob(ok, 'image/png') : ok(null)));
    const save = async () => {
      const b = await blob();
      if (!b) return;
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(b), download: 'chop-personality.png' });
      a.click();
      URL.revokeObjectURL(a.href);
    };
    const copy = () => navigator.clipboard?.writeText(link).then(() => setLinkCopied(true));
    // The game link: the same 12 plates, so a friend plays this exact flow.
    const sendGame = () => (navigator.share ? navigator.share({ title: C.APP_NAME, text: shareText, url: link }).catch(() => {}) : copy());
    // WhatsApp and Instagram get the card image with the caption, where the phone allows sharing files.
    const shareImage = async (fallback: () => void) => {
      const b = await blob();
      const files = b ? [new File([b], 'chop-personality.png', { type: 'image/png' })] : [];
      if (files.length && navigator.canShare?.({ files })) return navigator.share({ files, text: shareText }).catch(() => {});
      fallback();
    };
    const open = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');
    const tile = 'flex min-h-14 items-center gap-3 rounded-md border-2 border-ink bg-surface px-3.5 type-label';
    return (
      <section className="grid gap-3.5">
        <hr className="border-line" />
        <h1 className="type-display-l">{t(`${persona}.name`)}</h1>
        {/* The AI read takes the line's place; the fixed line shows while it loads or when there is none. */}
        <div aria-live="polite">
          {typeof read === 'string' && <p className="type-caption text-ink-2">{t('ai.label')}</p>}
          <p className="type-body-l">{typeof read === 'string' ? read : t(`${persona}.line`)}</p>
        </div>
        <canvas ref={canvas} width={W} height={H} className="w-full rounded-lg border-2 border-ink" aria-label={t(`${persona}.name`)} role="img" />
        <div className="grid gap-3">
          <div className="flex gap-3">
            <button type="button" onClick={save} className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-pill border-2 border-ink bg-palm shadow-button type-title-m">
              <DownloadIcon size={22} />
              {t('save')}
            </button>
            <button
              type="button"
              onClick={copy}
              aria-label={linkCopied ? t('share.copied') : t('share.copy')}
              className="grid size-14 shrink-0 place-items-center rounded-md border-2 border-ink bg-surface"
            >
              <CopyIcon size={22} />
            </button>
          </div>
          <span aria-live="polite" className="sr-only">
            {linkCopied ? t('share.copied') : ''}
          </span>
          <div className="flex gap-3">
            <button type="button" onClick={sendGame} className="flex min-h-14 flex-1 items-center justify-center rounded-pill border-2 border-ink bg-surface type-title-m">
              {t('share.game')}
            </button>
            <button
              type="button"
              onClick={() => sheet.current?.showModal()}
              aria-label={t('share.sheet')}
              className="grid size-14 shrink-0 place-items-center rounded-md border-2 border-ink bg-surface"
            >
              <ShareIcon size={22} />
            </button>
          </div>
          {/* A fresh deal from the server. */}
          <Link href="/play" className="mx-auto flex min-h-12 items-center px-3.5 type-label underline underline-offset-4">
            {t('again')}
          </Link>
        </div>
        <dialog
          ref={sheet}
          aria-labelledby="share-sheet"
          className="mx-auto mb-0 mt-auto max-h-[85dvh] w-full max-w-app rounded-t-xl border-2 border-ink bg-surface px-3.5 pb-3.5 pt-0 text-ink overscroll-contain backdrop:bg-overlay"
        >
          <div className="sticky top-0 flex items-center justify-between gap-3 bg-surface py-3.5">
            <h2 id="share-sheet" className="type-title-l">
              {t('share.sheet')}
            </h2>
            <CloseButton label={t('share.close')} />
          </div>
          <ul className="grid gap-2">
            <li>
              <button type="button" className={`${tile} w-full`} onClick={() => shareImage(() => open(`https://wa.me/?text=${encodeURIComponent(shareText)}`))}>
                {t('share.whatsapp')}
              </button>
            </li>
            <li>
              <button type="button" className={`${tile} w-full`} onClick={() => open(`https://x.com/intent/post?text=${encodeURIComponent(shareText)}`)}>
                {t('share.x')}
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`${tile} w-full`}
                onClick={() =>
                  shareImage(() => {
                    void save();
                    setIgSaved(true);
                  })
                }
              >
                {t('share.instagram')}
              </button>
              {igSaved && <p className="mt-1 type-caption text-ink-2">{t('share.saved')}</p>}
            </li>
            <li>
              <button type="button" className={`${tile} w-full`} onClick={() => open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`)}>
                {t('share.facebook')}
              </button>
            </li>
          </ul>
        </dialog>
      </section>
    );
  }

  return (
    <section className="grid gap-3.5">
      {/* A native progress bar: no inline style, which the strict CSP would block. */}
      <progress value={answered} max={deck.length} aria-label={t('progress', { n: answered, total: deck.length })} className="h-2 w-full accent-palm" />
      <p className="type-label text-ink-2">{t('progress', { n: answered + 1, total: deck.length })}</p>
      <article className="grid gap-3 rounded-lg border-2 border-ink bg-surface p-3.5">
        {card.picture ? (
          <Image
            key={card.id}
            src={card.picture}
            alt=""
            width={640}
            height={480}
            priority
            onLoad={() => setLoadedId(card.id)}
            className="aspect-[4/3] w-full rounded-md bg-sunken object-cover"
          />
        ) : (
          <span aria-hidden className="flex aspect-[4/3] w-full items-center justify-center rounded-md bg-palm-100 type-display-l">
            {card.name.charAt(0)}
          </span>
        )}
        {/* Loads the next card's picture now, at the same optimised URL, so it is ready on the next answer. */}
        {deck[answered + 1]?.picture && <Image src={deck[answered + 1].picture!} alt="" width={640} height={480} priority className="hidden" />}
        {/* The name waits for its picture, so both land together. */}
        <h2 className={`type-display-l ${!card.picture || loadedId === card.id ? '' : 'invisible'}`}>{card.name}</h2>
      </article>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => answer(false)} className="min-h-14 rounded-pill border-2 border-ink bg-surface type-title-m">
          {t('nah')}
        </button>
        <button type="button" onClick={() => answer(true)} className="min-h-14 rounded-pill border-2 border-ink bg-palm type-title-m">
          {t('yum')}
        </button>
      </div>
      {answered >= C.TASTE_GAME_MIN_ANSWERS && (
        <button type="button" onClick={() => setDone(true)} className="min-h-12 type-label underline">
          {t('finish')}
        </button>
      )}
    </section>
  );
}
