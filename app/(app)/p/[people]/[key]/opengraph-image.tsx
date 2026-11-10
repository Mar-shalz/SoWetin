import { ImageResponse } from 'next/og';
import { getTranslations } from 'next-intl/server';
import tokens from '@/design/tokens.json';
import { siteUrl } from '@/lib/db/env';
import { formatNaira } from '@/lib/i18n/money';
import { catalogueForRequest } from '@/lib/plates/serve';
import { shareCard, shortDate } from '@/lib/share/card';

// The link preview for a shared plate (S-022: the share card). Landscape, because apps crop previews to about 1.91:1
// and the word "Estimate" and the date must never be cropped out (S-017).
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
const c = (k: keyof typeof tokens.color) => tokens.color[k].$value;

// The default image font has no naira sign, so the text is drawn in our own fonts, fetched as a tiny subset of just
// the characters on the card. Without them the card still renders, with "N" for the sign.
async function font(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(3000) })
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    return url ? await (await fetch(url, { signal: AbortSignal.timeout(3000) })).arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ people: string; key: string }> }) {
  const [{ people, key }, { cat }, t] = await Promise.all([params, catalogueForRequest(), getTranslations()]);
  const card = cat && shareCard(cat, key, people);
  const title = card?.title ?? 'SoWetin';
  const price = card?.price
    ? t('share.card.price', {
        low: formatNaira(card.price.low),
        high: formatNaira(card.price.high),
        people: t('home.sentence.people', { count: card.people }),
        area: t('areas.lagos'),
      })
    : '';
  const estimate = card?.price ? t('share.card.estimate', { date: shortDate(card.price.date) }) : '';
  const sticker = t('share.sticker.plate');
  const host = new URL(siteUrl()).host;
  const text = `${title}${price}${estimate}${sticker}${host}`;
  const [display, body] = await Promise.all([font('Bricolage+Grotesque', 800, text), font('Plus+Jakarta+Sans', 600, text)]);
  const safe = (s: string) => (body ? s : s.replaceAll('₦', 'N'));
  // Satori draws PNG and JPEG; other picture formats are left out rather than breaking the preview.
  const picture = card?.picture && /\.(png|jpe?g)$/i.test(card.picture) ? card.picture : null;
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', background: c('cream'), color: c('ink'), fontFamily: 'Body' }}>
        {picture && (
          <img src={picture} alt="" width={630} height={630} style={{ objectFit: 'cover' }} />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, padding: 56, gap: 18 }}>
          <div style={{ display: 'flex', alignSelf: 'flex-start', background: c('egusi'), borderRadius: 999, padding: '8px 24px', fontSize: 36, fontFamily: 'Display' }}>
            {sticker}
          </div>
          <div style={{ display: 'flex', fontSize: picture ? 56 : 72, fontFamily: 'Display', lineHeight: 1.05 }}>{title}</div>
          {price && <div style={{ display: 'flex', fontSize: 40 }}>{safe(price)}</div>}
          {estimate && <div style={{ display: 'flex', fontSize: 30, color: c('ink-2') }}>{estimate}</div>}
          <div style={{ display: 'flex', fontSize: 28, marginTop: 12 }}>{host}</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        ...(display ? [{ name: 'Display', data: display, weight: 800 as const }] : []),
        ...(body ? [{ name: 'Body', data: body, weight: 600 as const }] : []),
      ],
    },
  );
}
