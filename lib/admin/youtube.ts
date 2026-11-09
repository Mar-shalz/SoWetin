// YouTube paste-in for A-05 (doc 05, section 7, step 3) without an API key: the video id from any common link, and
// its title, channel and thumbnail from YouTube's public oEmbed endpoint, which also refuses videos that can't be embedded.
export function youtubeId(input: string): string | null {
  try {
    const u = new URL(input.trim());
    const host = u.hostname.replace(/^(www|m|music)\./, '');
    const id =
      host === 'youtu.be'
        ? u.pathname.slice(1)
        : host === 'youtube.com' || host === 'youtube-nocookie.com'
          ? (u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1] ?? '')
          : '';
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export type VideoInfo = { title: string; channel: string; thumbnail: string | null };

export async function videoInfo(id: string, fetchFn: typeof fetch = fetch): Promise<VideoInfo | null> {
  const res = await fetchFn(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`, {
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res?.ok) return null;
  const j = (await res.json().catch(() => null)) as { title?: unknown; author_name?: unknown; thumbnail_url?: unknown } | null;
  if (!j || typeof j.title !== 'string' || typeof j.author_name !== 'string') return null;
  const thumb = typeof j.thumbnail_url === 'string' && j.thumbnail_url.startsWith('https://i.ytimg.com/') ? j.thumbnail_url : null;
  return { title: j.title.slice(0, 200), channel: j.author_name.slice(0, 120), thumbnail: thumb };
}
