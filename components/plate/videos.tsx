'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

export type VideoRef = { youtube_id: string; title: string; channel_title: string; duration_seconds: number | null; thumbnail_url: string | null };

// Video facade (doc 05, section 7, step 5): no YouTube code loads until someone asks. "Watch on YouTube" opens the app;
// "Play here" loads the privacy-enhanced player. The rest sit behind "More ways to cook it" (BR-50a).
export function Videos({ videos }: { videos: VideoRef[] }) {
  const t = useTranslations();
  const [playing, setPlaying] = useState(false);
  const [first, ...rest] = videos;
  if (!first) return null;
  const minutes = (v: VideoRef) => (v.duration_seconds ? ` · ${t('plate.why.time', { minutes: Math.round(v.duration_seconds / 60) })}` : '');
  const watch = (v: VideoRef) => `https://www.youtube.com/watch?v=${v.youtube_id}`;
  return (
    <section aria-labelledby="videos" className="grid gap-2">
      <h2 id="videos" className="type-title-m">
        {t('video.prefer')}
      </h2>
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${first.youtube_id}?autoplay=1`}
          title={first.title}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="aspect-video w-full rounded-md border-2 border-ink"
        />
      ) : (
        first.thumbnail_url && <Image src={first.thumbnail_url} alt="" width={480} height={360} className="aspect-video w-full rounded-md object-cover" />
      )}
      <p className="type-label">{first.title}</p>
      <p className="type-caption text-ink-2">
        {first.channel_title}
        {minutes(first)}
      </p>
      <div className="flex gap-3">
        <a
          href={watch(first)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-12 flex-1 items-center justify-center rounded-pill border-2 border-ink bg-palm px-4 type-label"
        >
          {t('video.watch')}
        </a>
        {!playing && (
          <button type="button" onClick={() => setPlaying(true)} className="min-h-12 flex-1 rounded-pill border-2 border-ink bg-surface px-4 type-label">
            {t('video.play')}
          </button>
        )}
      </div>
      {!!rest.length && (
        <details>
          <summary className="min-h-12 cursor-pointer py-3 type-label underline">{t('video.more')}</summary>
          <ul className="grid gap-2">
            {rest.map((v) => (
              <li key={v.youtube_id}>
                <a href={watch(v)} target="_blank" rel="noopener noreferrer" className="underline">
                  {v.title}
                </a>
                <span className="type-caption text-ink-2">
                  {' '}
                  · {v.channel_title}
                  {minutes(v)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="type-caption text-ink-2">{t('videos.note.line')}</p>
    </section>
  );
}
