import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, supabaseEnv } from './env';

// The signed-in person's own database client. Row-level security decides what it may read and write.
export async function db() {
  const env = supabaseEnv();
  if (!env) return null;
  const store = await cookies();
  return createServerClient(env.url, env.key, {
    cookieOptions: SESSION_COOKIE,
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const c of list) store.set(c.name, c.value, c.options);
        } catch {
          // Server Components can't set cookies. proxy.ts refreshes the session before they run.
        }
      },
    },
  });
}

export type Db = NonNullable<Awaited<ReturnType<typeof db>>>;
