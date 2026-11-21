import { describe, expect, it, vi } from 'vitest';
import { searchVideos } from '@/lib/admin/youtube';

const ok = (items: unknown[]) => vi.fn(async () => new Response(JSON.stringify({ items }), { status: 200 })) as unknown as typeof fetch;

describe('searchVideos', () => {
  it('maps results, asks for embeddable videos and drops bad ids', async () => {
    const f = ok([
      { id: { videoId: 'abcdefghijk' }, snippet: { title: 'Jollof', channelTitle: 'Chef', thumbnails: { medium: { url: 'https://i.ytimg.com/vi/x/mq.jpg' } } } },
      { id: { videoId: 'bad' }, snippet: { title: 'x' } },
    ]);
    const r = await searchVideos('jollof', 'k', 2, f);
    expect(r).toEqual([{ id: 'abcdefghijk', title: 'Jollof', channel: 'Chef', thumbnail: 'https://i.ytimg.com/vi/x/mq.jpg' }]);
    expect(String((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain('videoEmbeddable=true');
  });
  it('returns nothing when YouTube refuses', async () => {
    expect(await searchVideos('x', 'k', 1, (async () => new Response('{}', { status: 403 })) as unknown as typeof fetch)).toEqual([]);
  });
});
