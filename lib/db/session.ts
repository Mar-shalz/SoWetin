import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, supabaseEnv } from './env';

// Refreshes an expiring sign-in in proxy.ts, the one place that can write cookies before a page renders.
// Returns the cookies the response must set; they also go onto the request, so the page reads the fresh ones.
export async function refreshSession(request: NextRequest) {
  const env = supabaseEnv();
  const fresh: { name: string; value: string; options: CookieOptions }[] = [];
  if (!env) return fresh;
  const supabase = createServerClient(env.url, env.key, {
    cookieOptions: SESSION_COOKIE,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const c of list) {
          request.cookies.set(c.name, c.value);
          fresh.push(c);
        }
      },
    },
  });
  await supabase.auth.getClaims();
  return fresh;
}
