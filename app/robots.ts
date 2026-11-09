import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/db/env';

// Crawlers may read the public pages, never the admin or the API.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] }, sitemap: `${siteUrl()}/sitemap.xml` };
}
