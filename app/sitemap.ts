import type { MetadataRoute } from 'next';
import { publicClient } from '@/lib/catalogue/db';
import { siteUrl } from '@/lib/db/env';

// sitemap.xml (doc 05, section 8): the home page, the sources and privacy pages and every published dish, rebuilt hourly.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const client = publicClient();
  const { data } = client ? await client.from('components').select('id, published_at').eq('status', 'published') : { data: [] };
  return [
    { url: `${base}/` },
    { url: `${base}/legal/sources` },
    { url: `${base}/legal/privacy` },
    ...(data ?? []).map((d) => ({ url: `${base}/dish/${d.id}`, lastModified: d.published_at ?? undefined })),
  ];
}
