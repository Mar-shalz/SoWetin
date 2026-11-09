import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Security headers on every response (doc 13, section 7). The Content Security Policy is set per request in proxy.ts.
const SECURITY_HEADERS = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // The I cooked it frame uses a file input with capture, which opens the phone's camera app without the camera API (BR-160).
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

// Cache Components stay off: the app's root layout reads the language cookie for <html lang>,
// which Cache Components would block from prerendering. Public pages get their own static layout.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Dish pictures live in Supabase Storage and are resized through /_next/image, so the CSP stays 'self'.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/illustrations/**' },
      { protocol: 'https', hostname: 'i.ytimg.com', pathname: '/vi/**' },
    ],
  },
  headers: async () => [{ source: '/:path*', headers: SECURITY_HEADERS }],
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default createNextIntlPlugin('./lib/i18n/request.ts')(nextConfig);
