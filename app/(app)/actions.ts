'use server';

import { cookies } from 'next/headers';
import { LOCALE_COOKIE, LOCALES, type Locale } from '@/lib/i18n/request';

// Me > Settings > Language, and the Pidgin offer (BR-111). Before accounts the choice lives in a cookie on this phone.
// Setting a cookie in a Server Action re-renders the page in the new language.
export async function setLanguage(form: FormData) {
  const locale = form.get('locale');
  if (!LOCALES.includes(locale as Locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale as Locale, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}
