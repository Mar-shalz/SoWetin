import { t } from '@/lib/admin/t';
import { SignInForm } from './form';

export default function SignInPage() {
  return (
    <main className="mx-auto max-w-md">
      <h1 className="type-title-l">{t('signIn.title')}</h1>
      <p className="mt-2 text-ink-2">{t('signIn.intro')}</p>
      <SignInForm
        l={{
          email: t('signIn.email'),
          send: t('signIn.send'),
          sending: t('signIn.sending'),
          code: t('signIn.code'),
          verify: t('signIn.verify'),
          verifying: t('signIn.verifying'),
        }}
      />
    </main>
  );
}
