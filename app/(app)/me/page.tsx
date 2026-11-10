import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { BottomNav } from '@/components/nav/bottom-nav';
import { MotionSetting } from '@/components/nav/motion-tier';
import { PersonalityCard } from '@/components/play/personality-card';
import { ChevronIcon } from '@/components/ui/icons';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { setLanguage } from '../actions';

// S-013 Me, before accounts: what lives on this phone, and the pages people look for.
// Me > Settings > Language (BR-111) shows once Pidgin is approved (BR-110).
// shortcut: no sign-in, allergies or data export until accounts and consent arrive (M3).
export default async function MePage() {
  const t = await getTranslations();
  const locale = await getLocale();
  const links = [
    ['/saved', t('nav.saved')],
    ['/legal/sources', t('legal.sources.title')],
    ['/legal/privacy', t('legal.privacy.title')],
  ] as const;
  return (
    <main className="mx-auto flex min-h-dvh max-w-app flex-col gap-4 px-4 pt-6">
      <h1 className="type-display-l">{t('nav.me')}</h1>
      <p className="text-ink-2">{t('me.onPhone')}</p>
      {C.TASTE_GAME_ENABLED && <PersonalityCard />}
      <ul className="grid gap-3">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="flex min-h-14 items-center justify-between gap-3 rounded-lg border-2 border-ink bg-surface px-4 type-label">
              {label}
              <ChevronIcon size={20} />
            </Link>
          </li>
        ))}
      </ul>
      <section aria-labelledby="signup" className="rounded-lg border-2 border-dashed border-ink-3 p-4">
        <h2 id="signup" className="type-title-m">
          {t('me.signup.title')}
        </h2>
        <ul className="mt-2 grid list-disc gap-1 pl-5">
          <li>{t('me.signup.allergy')}</li>
          <li>{t('me.signup.saves')}</li>
        </ul>
      </section>
      <MotionSetting />
      {C.PIDGIN_ENABLED && (
        <form action={setLanguage}>
          <fieldset>
            <legend className="type-label">{t('settings.language._')}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(['en-NG', 'pcm'] as const).map((l) => (
                <button
                  key={l}
                  name="locale"
                  value={l}
                  aria-pressed={locale === l}
                  className={`min-h-12 rounded-pill border-2 px-4 type-label ${locale === l ? 'border-ink bg-palm-100' : 'border-ink-3 bg-surface'}`}
                >
                  {t(l === 'pcm' ? 'settings.language.pcm' : 'settings.language.en')}
                </button>
              ))}
            </div>
          </fieldset>
        </form>
      )}
      <div className="mt-auto" />
      <BottomNav current="me" />
    </main>
  );
}
