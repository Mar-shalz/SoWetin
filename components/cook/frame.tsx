'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { formatNaira } from '@/lib/i18n/money';

export type FramePrice = { low: number; high: number; date: string } | null;
const W = 1080;
const H = 1350;

// S-029 I cooked it frame (F30): the photo is drawn on this phone only and never uploaded (doc 13). The phone's own camera
// opens through a file input, so no camera permission is needed. Price on by default (D-30), labelled "Estimate".
// shortcut: no WhatsApp share sheet or illustration yet; "Use the drawing instead" draws a plain enamel plate.
export function Frame({ plate, price, fonts, onDone }: { plate: string; price: FramePrice; fonts: { display: string; body: string }; onDone: () => void }) {
  const t = useTranslations();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [showPrice, setShowPrice] = useState(true);
  const [name, setName] = useState('');
  const [copied, setCopied] = useState(false);

  const pick = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      setPhoto(img);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  useEffect(() => {
    if (!canvas.current || (!photo && !drawing)) return;
    const ctx = canvas.current.getContext('2d')!;
    const css = getComputedStyle(document.documentElement);
    const c = (n: string) => css.getPropertyValue(`--color-${n}`).trim() || '#1C1512';
    ctx.fillStyle = c('cream');
    ctx.fillRect(0, 0, W, H);
    // The enamel plate: a rim with a chipped edge, then the photo (or the plain plate) inside it.
    const cx = W / 2;
    const cy = 600;
    const r = 420;
    ctx.fillStyle = c('surface');
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 28;
    ctx.strokeStyle = c('enamel');
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0.15, Math.PI * 2 - 0.05);
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r - 40, 0, Math.PI * 2);
    ctx.clip();
    if (photo) {
      const s = Math.max(((r - 40) * 2) / photo.width, ((r - 40) * 2) / photo.height);
      ctx.drawImage(photo, cx - (photo.width * s) / 2, cy - (photo.height * s) / 2, photo.width * s, photo.height * s);
    } else {
      ctx.fillStyle = c('palm-100');
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    ctx.restore();
    // The sticker, the plate, the price and who cooked it.
    ctx.fillStyle = c('egusi');
    ctx.beginPath();
    ctx.ellipse(cx + 300, cy - 330, 190, 80, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c('ink');
    ctx.textAlign = 'center';
    ctx.font = `800 52px ${fonts.display}`;
    ctx.fillText(t('frame.sticker'), cx + 300, cy - 312);
    ctx.font = `600 40px ${fonts.body}`;
    ctx.fillText(name.trim() ? t('frame.eyebrow.name', { name: name.trim() }) : t('frame.eyebrow.self'), cx, 1110);
    ctx.font = `800 64px ${fonts.display}`;
    ctx.fillText(plate, cx, 1190, W - 120);
    if (showPrice && price) {
      ctx.font = `600 40px ${fonts.body}`;
      ctx.fillText(
        `${t('plate.price.range', { low: formatNaira(price.low), high: formatNaira(price.high) })} · ${t('plate.price.meta.ageing', { area: t('areas.lagos'), date: price.date })}`,
        cx,
        1260,
        W - 120,
      );
    }
    ctx.font = `700 36px ${fonts.body}`;
    ctx.fillText('sowetin.com', cx, 1320);
  }, [photo, drawing, showPrice, name, price, plate, t, fonts]);

  const save = () =>
    canvas.current?.toBlob((blob) => {
      if (!blob) return;
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'i-cooked-it.png' });
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/png');

  return (
    <section className="grid gap-4">
      <h1 className="type-display-l">{t('frame.title')}</h1>
      <p>{t('frame.body')}</p>
      <label className="flex min-h-14 cursor-pointer items-center justify-center rounded-pill border-2 border-ink bg-palm type-title-m focus-within:outline-3 focus-within:outline-focus">
        {t('frame.photo')}
        <input type="file" accept="image/*" capture="environment" onChange={(e) => pick(e.target.files?.[0])} className="sr-only" />
      </label>
      <button type="button" onClick={() => setDrawing(true)} className="min-h-12 type-label underline">
        {t('frame.drawing')}
      </button>
      <p className="type-caption text-ink-2">{t('frame.privacy')}</p>
      {(photo || drawing) && (
        <>
          <canvas ref={canvas} width={W} height={H} role="img" aria-label={plate} className="w-full rounded-lg border-2 border-ink" />
          <label className="flex min-h-12 items-center gap-3 type-label">
            <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} className="size-6" />
            {t('frame.price')}
          </label>
          <label className="grid gap-1">
            <span className="type-label">{t('frame.name.label')}</span>
            <input
              value={name}
              maxLength={30}
              onChange={(e) => setName(e.target.value)}
              className="min-h-12 rounded-md border border-ink-3 bg-sunken px-3 type-input"
            />
          </label>
          <button type="button" onClick={save} className="min-h-14 rounded-pill border-2 border-ink bg-palm type-title-m">
            {t('frame.save')}
          </button>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(t('frame.caption', { plate })).then(() => setCopied(true))}
            className="min-h-12 rounded-pill border-2 border-ink bg-surface type-label"
          >
            {copied ? t('frame.copied') : t('frame.copy')}
          </button>
        </>
      )}
      <button type="button" onClick={onDone} className="min-h-12 type-label underline">
        {t('frame.done')}
      </button>
    </section>
  );
}
