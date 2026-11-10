'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { formatNaira } from '@/lib/i18n/money';
import { sharePath, shortDate, type ShareCard } from '@/lib/share/path';

const W = 1080;
const H = 1350;

// S-017 Share: a 1080 × 1350 card drawn on this phone (no upload), then the system share sheet with the image where the
// phone has one, plus WhatsApp, Copy link and Download image. "Estimate" and the date sit inside the card, never at an edge.
// shortcut: no 1080 × 1920 story variant yet; Status takes the 4:5 card as it is.
export function ShareButton({ card, fonts }: { card: ShareCard; fonts: { display: string; body: string } }) {
  const t = useTranslations();
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [picture, setPicture] = useState<HTMLImageElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);
  const link = typeof window === 'undefined' ? '' : `${location.origin}${sharePath(card.key, card.people)}`;
  const text = t('share.text', { plate: card.title, link });

  // Through the app's own image route, so the canvas stays readable (same origin) and the page's CSP allows it.
  useEffect(() => {
    if (!open || !card.picture) return;
    const img = new window.Image();
    img.onload = () => setPicture(img);
    img.src = `/_next/image?url=${encodeURIComponent(card.picture)}&w=1080&q=75`;
  }, [open, card.picture]);

  useEffect(() => {
    if (!open || !canvas.current) return;
    const ctx = canvas.current.getContext('2d')!;
    const css = getComputedStyle(document.documentElement);
    const c = (n: string) => css.getPropertyValue(`--color-${n}`).trim() || '#1C1512';
    ctx.fillStyle = c('cream');
    ctx.fillRect(0, 0, W, H);
    const top = 60;
    const side = 780;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect((W - side) / 2, top, side, side, 48);
    ctx.clip();
    if (picture) {
      const s = Math.max(side / picture.width, side / picture.height);
      ctx.drawImage(picture, W / 2 - (picture.width * s) / 2, top + side / 2 - (picture.height * s) / 2, picture.width * s, picture.height * s);
    } else {
      ctx.fillStyle = c('palm-100');
      ctx.fillRect(0, top, W, side);
    }
    ctx.restore();
    ctx.fillStyle = c('egusi');
    ctx.beginPath();
    ctx.ellipse(W - 220, top + 40, 170, 70, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c('ink');
    ctx.textAlign = 'center';
    ctx.font = `800 50px ${fonts.display}`;
    ctx.fillText(t('share.sticker.plate'), W - 220, top + 58);
    let y = top + side + 90;
    if (name.trim()) {
      ctx.font = `600 38px ${fonts.body}`;
      ctx.fillText(t('share.card.from', { name: name.trim() }), W / 2, y);
      y += 70;
    }
    ctx.font = `800 64px ${fonts.display}`;
    ctx.fillText(card.title, W / 2, y, W - 120);
    if (card.price) {
      ctx.font = `700 46px ${fonts.body}`;
      ctx.fillText(
        t('share.card.price', {
          low: formatNaira(card.price.low),
          high: formatNaira(card.price.high),
          people: t('home.sentence.people', { count: card.people }),
          area: t('areas.lagos'),
        }),
        W / 2,
        y + 80,
        W - 120,
      );
      ctx.font = `600 34px ${fonts.body}`;
      ctx.fillText(t('share.card.estimate', { date: shortDate(card.price.date) }), W / 2, y + 135, W - 120);
    }
    ctx.font = `700 32px ${fonts.body}`;
    ctx.fillText(location.host, W / 2, H - 50);
  }, [open, picture, name, card, fonts, t]);

  const image = () =>
    new Promise<File | null>((done) => canvas.current?.toBlob((b) => done(b && new File([b], 'sowetin-plate.png', { type: 'image/png' })), 'image/png') ?? done(null));

  async function shareSheet() {
    const file = await image();
    if (!file) return;
    await navigator.share({ files: [file], text }).catch(() => undefined); // closing the sheet isn't an error
  }
  async function download() {
    const file = await image();
    if (!file) return;
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(file), download: file.name });
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const pill = 'flex min-h-12 items-center justify-center rounded-pill border-2 border-ink px-4 type-label';
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setCanShareFiles(!!navigator.canShare?.({ files: [new File([''], 'x.png', { type: 'image/png' })] }));
          dialog.current?.showModal();
        }}
        className="flex min-h-12 flex-col items-start justify-center rounded-lg border-2 border-ink bg-surface px-4 py-2 text-left"
      >
        <span className="type-label">{t('plate.more.share._')}</span>
        <span className="type-caption text-ink-2">{t('plate.more.share.hint')}</span>
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="share-title"
        onClose={() => setOpen(false)}
        className="mx-auto mb-0 mt-auto max-h-[90dvh] w-full max-w-app rounded-t-xl border-2 border-ink bg-surface p-5 text-ink backdrop:bg-overlay"
      >
        <div className="flex items-center justify-between">
          <h2 id="share-title" className="type-title-l">
            {t('plate.more.share._')}
          </h2>
          <form method="dialog">
            <button className="min-h-12 px-3 type-label underline">{t('chef.close')}</button>
          </form>
        </div>
        <canvas ref={canvas} width={W} height={H} role="img" aria-label={card.title} className="mt-3 w-full rounded-lg border-2 border-ink" />
        <label className="mt-3 grid gap-1">
          <span className="type-label">{t('frame.name.label')}</span>
          <input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} className="min-h-12 rounded-md border border-ink-3 bg-sunken px-3 type-input" />
        </label>
        <div className="mt-4 grid gap-2">
          {canShareFiles && (
            <button type="button" onClick={shareSheet} className={`${pill} bg-palm`}>
              {t('plate.more.share._')}
            </button>
          )}
          <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className={`${pill} ${canShareFiles ? 'bg-surface' : 'bg-palm'}`}>
            {t('market.share')}
          </a>
          <button type="button" onClick={() => navigator.clipboard?.writeText(link).then(() => setCopied(true))} className={`${pill} bg-surface`}>
            {copied ? t('share.copied') : t('share.copy')}
          </button>
          <button type="button" onClick={download} className={`${pill} bg-surface`}>
            {t('share.download')}
          </button>
        </div>
      </dialog>
    </>
  );
}
