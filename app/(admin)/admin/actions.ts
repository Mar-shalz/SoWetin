'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { Msg } from '@/components/admin/action-form';
import { requireStaff } from '@/lib/admin/guard';
import { DISH_ID, methodFromForm } from '@/lib/admin/method';
import { t } from '@/lib/admin/t';
import { methodFromDraft, t3Draft, T3_PROMPT_VERSION, type T3Dish } from '@/lib/ai/t3';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { db, type Db } from '@/lib/db/server';

// Admin server actions. Every input is checked with Zod. Dish actions start with requireStaff, and the database
// checks the role and second factor again; the sign-in steps only ever touch the caller's own session.

export type SignInState = { error?: string };

// shortcut: email and password while Victor tests (9 November 2026, D-33). Doc 13 wants emailed codes, so switch back
// before other staff join. The authenticator step after this is unchanged, and the database still demands it.
export async function signIn(_: SignInState, form: FormData): Promise<SignInState> {
  const supabase = await db();
  if (!supabase) return { error: t('signIn.notConfigured') };
  const email = z
    .email()
    .max(254)
    .safeParse(
      String(form.get('email') ?? '')
        .trim()
        .toLowerCase(),
    );
  const password = z
    .string()
    .min(8)
    .max(200)
    .safeParse(String(form.get('password') ?? ''));
  if (!email.success || !password.success) return { error: t('signIn.wrong') };
  const { error } = await supabase.auth.signInWithPassword({ email: email.data, password: password.data });
  if (error) {
    console.error('signIn', error.status, error.code);
    return { error: error.status === 429 ? t('signIn.wait') : t('signIn.wrong') };
  }
  redirect('/admin/mfa');
}

export type MfaState = { factorId?: string; qr?: string; secret?: string; error?: string };

// Without a code: start an authenticator setup. With one: check it, which lifts the session to aal2.
export async function mfa(state: MfaState, form: FormData): Promise<MfaState> {
  const supabase = await db();
  const user = supabase && (await supabase.auth.getUser()).data.user;
  if (!supabase || !user) redirect('/admin/sign-in');
  if (form.get('code') === null) {
    // Clear half-finished setups first, so reloading the page never piles them up.
    const { data } = await supabase.auth.mfa.listFactors();
    for (const f of data?.all ?? []) if (f.factor_type === 'totp' && f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data: e, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'SoWetin admin' });
    if (error || !e) return { error: t('mfa.setupFailed') };
    return { factorId: e.id, qr: e.totp.qr_code, secret: e.totp.secret };
  }
  const factorId = z.uuid().safeParse(form.get('factor'));
  const code = String(form.get('code')).replace(/\s/g, '');
  if (!factorId.success || !/^\d{6}$/.test(code)) return { ...state, error: t('mfa.codeInvalid') };
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factorId.data, code });
  if (error) return { ...state, error: t('mfa.codeWrong') };
  redirect('/admin');
}

export async function signOut() {
  await (await db())?.auth.signOut();
  redirect('/admin/sign-in');
}

// The database's guard messages map to plain words; anything else is logged and shown as a generic failure.
function failed(e: { message: string }): Msg {
  if (e.message.startsWith('Not ready to publish')) return { error: t('errors.notReady') };
  if (e.message.startsWith('Unpublish')) return { error: t('errors.frozen') };
  console.error('admin', e.message);
  return { error: t('errors.save') };
}
const invalid = (field: string): Msg => ({ error: t('errors.invalid', { field }) });

export async function saveMethod(_: Msg, form: FormData): Promise<Msg> {
  const { supabase } = await requireStaff();
  const id = DISH_ID.safeParse(form.get('id'));
  if (!id.success) return invalid('id');
  const method = methodFromForm(form);
  if (!method.success) return invalid(method.error.issues[0]?.path.join(' ') || 'form');
  const { error } = await supabase.rpc('apply_method', { cid: id.data, m: method.data });
  if (error) return failed(error);
  revalidatePath(`/admin/dishes/${id.data}`);
  return { ok: t('review.saved') };
}

export async function markTested(_: Msg, form: FormData): Promise<Msg> {
  const { supabase } = await requireStaff();
  const id = DISH_ID.safeParse(form.get('id'));
  const day = z.iso.date().safeParse(form.get('tested_at'));
  if (!id.success) return invalid('id');
  if (!day.success || day.data > lagosToday()) return invalid(t('review.testedDate'));
  const { error } = await supabase.rpc('apply_method', { cid: id.data, m: { tested_at: day.data } });
  if (error) return failed(error);
  revalidatePath(`/admin/dishes/${id.data}`);
  return { ok: t('review.testedSaved') };
}

export async function setStatus(_: Msg, form: FormData): Promise<Msg> {
  const { supabase } = await requireStaff();
  const id = DISH_ID.safeParse(form.get('id'));
  const status = z.enum(['published', 'draft']).safeParse(form.get('status'));
  if (!id.success || !status.success) return invalid('status');
  const { data, error } = await supabase.from('components').update({ status: status.data }).eq('id', id.data).select('id');
  if (error) return failed(error);
  if (!data?.length) return { error: t('errors.save') };
  revalidatePath('/admin', 'layout');
  return { ok: status.data === 'published' ? t('review.published') : t('review.unpublished') };
}

const DISH_FOR_AI =
  'id, name, types, region, cuisine_family, local_names, aliases, total_minutes, batch_servings_min, equipment, component_ingredients(ingredient_id, optional, ingredients(name, canonical_unit))';
type DraftOutcome = 'ok' | 'quota' | 'failed' | 'not_configured';
const OUTCOME = { quota: 'quota', timeout: 'fallback_timeout', invalid: 'fallback_schema', stopped: 'fallback_refusal', failed: 'error' } as const;

// One T3 call for one dish: logged in ai_calls (doc 03, 7.0 rule 8); a valid answer is kept as a draft for review.
async function draftOne(supabase: Db, userId: string, id: string): Promise<DraftOutcome> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return 'not_configured';
  const { data: dish } = await supabase.from('components').select(DISH_FOR_AI).eq('id', id).maybeSingle();
  if (!dish) return 'failed';
  const r = await t3Draft(dish as unknown as T3Dish, { key, model: C.AI_MODEL_AUTHORING, timeoutMs: C.AI_DRAFT_TIMEOUT_MS });
  await supabase.from('ai_calls').insert({
    task: 'draft',
    model: C.AI_MODEL_AUTHORING,
    prompt_version: T3_PROMPT_VERSION,
    user_id: userId,
    input_tokens: r.usage?.input,
    output_tokens: r.usage?.output,
    latency_ms: r.latencyMs,
    stop_reason: r.stop,
    outcome: r.ok ? 'ok' : OUTCOME[r.reason],
  });
  if (!r.ok) return r.reason === 'quota' ? 'quota' : 'failed';
  const { error } = await supabase.from('content_drafts').insert({ component_id: id, kind: 'full_recipe', payload: r.draft, model: C.AI_MODEL_AUTHORING });
  return error ? 'failed' : 'ok';
}

const draftMsg = (r: DraftOutcome, count: number): Msg => (r === 'ok' ? { ok: t('drafts.ok', { count }) } : { error: t(`drafts.${r}`, { count }) });

export async function requestDraft(_: Msg, form: FormData): Promise<Msg> {
  const { supabase, user } = await requireStaff();
  const id = DISH_ID.safeParse(form.get('id'));
  if (!id.success) return invalid('id');
  const r = await draftOne(supabase, user.id, id.data);
  revalidatePath(`/admin/dishes/${id.data}`);
  return draftMsg(r, r === 'ok' ? 1 : 0);
}

// Drafts the next few dishes that have no method and no draft waiting, most popular first, one call at a time.
export async function requestDrafts(): Promise<Msg> {
  const { supabase, user } = await requireStaff();
  const { data } = await supabase
    .from('components')
    .select('id, component_steps(count), content_drafts(status)')
    .eq('status', 'draft')
    .order('popularity_prior', { ascending: false });
  const todo = ((data ?? []) as { id: string; component_steps: { count: number }[]; content_drafts: { status: string }[] }[])
    .filter((c) => !c.component_steps[0]?.count && !c.content_drafts.some((d) => d.status === 'needs_review'))
    .slice(0, C.AI_DRAFT_BATCH);
  let count = 0;
  for (const c of todo) {
    const r = await draftOne(supabase, user.id, c.id);
    if (r !== 'ok') {
      revalidatePath('/admin');
      return draftMsg(r, count);
    }
    count++;
  }
  revalidatePath('/admin');
  return draftMsg('ok', count);
}

export async function acceptDraft(_: Msg, form: FormData): Promise<Msg> {
  const { supabase, user } = await requireStaff();
  const draftId = z.uuid().safeParse(form.get('draft'));
  if (!draftId.success) return invalid('draft');
  const { data: d } = await supabase
    .from('content_drafts')
    .select('component_id, payload, components(local_names, aliases)')
    .eq('id', draftId.data)
    .eq('status', 'needs_review')
    .maybeSingle();
  const method = d && methodFromDraft(d.payload);
  if (!d || !method) return invalid('draft');
  // Names a person already wrote win; the draft only adds to them.
  const current = d.components as unknown as { local_names: Record<string, string>; aliases: string[] };
  method.local_names = { ...method.local_names, ...current.local_names };
  method.aliases = [...new Set([...current.aliases, ...method.aliases])];
  const { error } = await supabase.rpc('apply_method', { cid: d.component_id, m: method });
  if (error) return failed(error);
  await supabase.from('content_drafts').update({ status: 'accepted', reviewed_by: user.id }).eq('id', draftId.data);
  revalidatePath(`/admin/dishes/${d.component_id}`);
  return { ok: t('review.draftUsed') };
}

export async function rejectDraft(_: Msg, form: FormData): Promise<Msg> {
  const { supabase, user } = await requireStaff();
  const draftId = z.uuid().safeParse(form.get('draft'));
  if (!draftId.success) return invalid('draft');
  const { data, error } = await supabase
    .from('content_drafts')
    .update({ status: 'rejected', reviewed_by: user.id })
    .eq('id', draftId.data)
    .select('component_id');
  if (error || !data?.length) return { error: t('errors.save') };
  revalidatePath(`/admin/dishes/${data[0].component_id}`);
  return { ok: t('review.draftRejected') };
}

function lagosToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: C.TIMEZONE }).format(new Date());
}
