import { NextResponse, type NextRequest } from 'next/server';
import { refreshSession } from '@/lib/db/session';

// Strict Content Security Policy with a fresh nonce per request (doc 13, section 7; Next.js CSP guide).
// Next.js reads the request header and puts the nonce on its own scripts. Dev needs 'unsafe-eval' for React's error overlay.
export async function proxy(request: NextRequest) {
  // Sign-ins refresh here, before the page renders (Supabase SSR). Visitors without a session cookie skip it.
  const fresh = request.cookies.getAll().some((c) => c.name.startsWith('sb-')) ? await refreshSession(request) : [];
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const dev = process.env.NODE_ENV === 'development';
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');

  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers } });
  for (const c of fresh) response.cookies.set(c.name, c.value, c.options);
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
