import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { APP_CONFIG } from '@/lib/config/app.config';

export const LOCALES = ['en-NG', 'pcm'] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = 'sw_lang';

// The language lives in the profile and a cookie, not the URL (doc 06). Pidgin stays off until approved (BR-110).
// A page may still ask for English by name, for the English line under Pidgin safety text (BR-114).
export default getRequestConfig(async ({ locale: named }) => {
  const asked = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale = named === 'en-NG' ? 'en-NG' : APP_CONFIG.PIDGIN_ENABLED && asked === 'pcm' ? 'pcm' : 'en-NG';
  return { locale, messages: (await import(`../../messages/${locale}.json`)).default };
});
