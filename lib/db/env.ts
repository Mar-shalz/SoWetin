// Where the database is and the public key the app uses for it. Null when not configured (unit tests, CI).
export function supabaseEnv(env: Record<string, string | undefined> = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

// Session cookies stay out of reach of page scripts (doc 13: HttpOnly, Secure, SameSite=Lax).
export const SESSION_COOKIE = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' } as const;

// Public address of a dish picture in the illustrations bucket (migration 20261109040000).
export const pictureUrl = (path: string | null) => {
  const env = supabaseEnv();
  return path && env ? `${env.url}/storage/v1/object/public/illustrations/${path}` : null;
};
