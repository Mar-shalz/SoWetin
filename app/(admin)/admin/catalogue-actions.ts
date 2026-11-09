'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Msg } from '@/components/admin/action-form';
import { requireStaff } from '@/lib/admin/guard';
import { LANGS } from '@/lib/admin/method';
import { t } from '@/lib/admin/t';

const SLUG = z.string().regex(/^[a-z0-9-]{1,80}$/);

// A-06: approve or hold back a pairing, and adjust its score (BR-42).
export async function savePairing(_: Msg, form: FormData): Promise<Msg> {
  const { supabase } = await requireStaff();
  const p = z.object({ a: SLUG, b: SLUG, status: z.enum(['draft', 'approved']), score: z.coerce.number().min(0).max(1) }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: t('errors.invalid', { field: p.error.issues[0]?.path.join(' ') ?? 'form' }) };
  const { data, error } = await supabase
    .from('pairings')
    .update({ status: p.data.status, score: p.data.score })
    .eq('component_a', p.data.a)
    .eq('component_b', p.data.b)
    .select('component_a');
  if (error || !data?.length) return { error: t('errors.save') };
  revalidatePath('/admin/pairings');
  return { ok: t('review.saved') };
}

// A-07: names, local names and the house group. Allergen flags are locked in the database (doc 05, 5.2).
export async function saveIngredient(_: Msg, form: FormData): Promise<Msg> {
  const { supabase } = await requireStaff();
  const get = (k: string) => String(form.get(k) ?? '').trim();
  const p = z
    .object({
      id: SLUG,
      name: z.string().min(2).max(80),
      house_group: z.enum(['', 'foodstuff', 'basic']),
      local_names: z.partialRecord(z.enum(LANGS), z.string().min(1).max(60)),
    })
    .safeParse({
      id: get('id'),
      name: get('name'),
      house_group: get('house_group'),
      local_names: Object.fromEntries(LANGS.map((l) => [l, get(`local_names.${l}`)]).filter(([, v]) => v)),
    });
  if (!p.success) return { error: t('errors.invalid', { field: p.error.issues[0]?.path.join(' ') ?? 'form' }) };
  const { data, error } = await supabase
    .from('ingredients')
    .update({ name: p.data.name, house_group: p.data.house_group || null, local_names: p.data.local_names })
    .eq('id', p.data.id)
    .select('id');
  if (error || !data?.length) return { error: t('errors.save') };
  revalidatePath('/admin/ingredients');
  return { ok: t('review.saved') };
}
