import { redirect } from 'next/navigation';
import { AdminHeader } from '@/components/admin/header';
import { t } from '@/lib/admin/t';
import { db } from '@/lib/db/server';

// Signed in with the second factor, but no admin or editor role: say so and nothing else.
export default async function NoAccessPage() {
  const supabase = await db();
  const user = supabase && (await supabase.auth.getUser()).data.user;
  if (!user) redirect('/admin/sign-in');
  return (
    <>
      <AdminHeader email={user.email} />
      <main className="max-w-xl">
        <h1 className="type-title-l">{t('noAccess.title')}</h1>
        <p className="mt-2">{t('noAccess.body', { email: user.email ?? '' })}</p>
      </main>
    </>
  );
}
