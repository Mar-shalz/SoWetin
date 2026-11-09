import { redirect } from 'next/navigation';
import { t } from '@/lib/admin/t';
import { db } from '@/lib/db/server';
import { MfaForm } from './form';

// The second factor (doc 13): set up an authenticator app once, then a code from it on every sign-in.
export default async function MfaPage() {
  const supabase = await db();
  const user = supabase && (await supabase.auth.getUser()).data.user;
  if (!supabase || !user) redirect('/admin/sign-in');
  const [{ data: aal }, { data: factors }] = await Promise.all([supabase.auth.mfa.getAuthenticatorAssuranceLevel(), supabase.auth.mfa.listFactors()]);
  if (aal?.currentLevel === 'aal2') redirect('/admin');
  const factor = factors?.totp.find((f) => f.status === 'verified');
  return (
    <main className="mx-auto max-w-md">
      <h1 className="type-title-l">{factor ? t('mfa.title') : t('mfa.setupTitle')}</h1>
      <p className="mt-2 text-ink-2">{factor ? t('mfa.intro') : t('mfa.setupIntro')}</p>
      <MfaForm
        factorId={factor?.id}
        l={{
          start: t('mfa.start'),
          starting: t('mfa.starting'),
          scan: t('mfa.scan'),
          qrAlt: t('mfa.qrAlt'),
          secret: t('mfa.secret'),
          code: t('mfa.code'),
          verify: t('mfa.verify'),
          verifying: t('mfa.verifying'),
        }}
      />
    </main>
  );
}
