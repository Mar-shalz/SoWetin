import { redirect } from 'next/navigation';
import { db } from '@/lib/db/server';

// Every admin page and action starts here (doc 13: the role is checked server-side on every request).
// The database checks the same role and second factor again on every row it serves.
export async function requireStaff() {
  const supabase = await db();
  if (!supabase) redirect('/admin/sign-in');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/admin/sign-in');
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== 'aal2') redirect('/admin/mfa');
  const { data: staff } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
  if (!staff) redirect('/admin/no-access');
  return { supabase, user, role: staff.role as 'admin' | 'editor' };
}
