'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Msg } from '@/components/admin/action-form';
import { requireStaff } from '@/lib/admin/guard';
import { t } from '@/lib/admin/t';
import { searchVideos, videoInfo, youtubeId } from '@/lib/admin/youtube';
import { APP_CONFIG as C } from '@/lib/config/app.config';

const SLUG = z.string().regex(/^[a-z0-9-]{1,80}$/);

// Paste a YouTube link for a dish: it becomes the next approved video, up to MAX_VIDEOS_PER_COMPONENT (FR-032).
export async function addVideo(_: Msg, form: FormData): Promise<Msg> {
  const { supabase, user } = await requireStaff();
  const p = z
    .object({
      component_id: SLUG,
      url: z.string().max(300),
      language: z.enum(['en', 'pcm', 'yo', 'ig', 'ha', 'other']),
      minutes: z.union([z.literal(''), z.coerce.number().int().min(1).max(240)]),
    })
    .safeParse(Object.fromEntries(form));
  const id = p.success ? youtubeId(p.data.url) : null;
  if (!p.success || !id) return { error: t('videos.badLink') };
  const { data: existing } = await supabase.from('videos').select('rank').eq('component_id', p.data.component_id).eq('status', 'approved');
  if ((existing?.length ?? 0) >= C.MAX_VIDEOS_PER_COMPONENT) return { error: t('videos.full', { max: C.MAX_VIDEOS_PER_COMPONENT }) };
  const info = await videoInfo(id);
  if (!info) return { error: t('videos.notEmbeddable') };
  const minutes = p.data.minutes === '' ? null : p.data.minutes;
  const { error } = await supabase.from('videos').insert({
    component_id: p.data.component_id,
    youtube_id: id,
    title: info.title,
    channel_title: info.channel,
    thumbnail_url: info.thumbnail,
    duration_seconds: minutes ? minutes * 60 : null,
    language: p.data.language,
    style: minutes && minutes <= C.QUICK_VIDEO_MAX_MINUTES ? 'quick' : 'full',
    rank: Math.max(0, ...(existing ?? []).map((v) => v.rank ?? 0)) + 1,
    status: 'approved',
    approved_by: user.id,
    last_checked_at: new Date().toISOString(),
  });
  if (error) return { error: error.code === '23505' ? t('videos.duplicate') : t('errors.save') };
  revalidatePath('/admin/videos');
  return { ok: t('videos.added') };
}

// Move a video one place up (the first becomes the primary, doc 05), or hide it; the rest close the gap.
export async function changeVideo(_: Msg, form: FormData): Promise<Msg> {
  const { supabase } = await requireStaff();
  const p = z.object({ id: z.uuid(), component_id: SLUG, op: z.enum(['up', 'hide']) }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: t('errors.save') };
  const { data } = await supabase.from('videos').select('id, rank').eq('component_id', p.data.component_id).eq('status', 'approved').order('rank');
  const order = (data ?? []).map((v) => v.id as string);
  const i = order.indexOf(p.data.id);
  if (i < 0) return { error: t('errors.save') };
  if (p.data.op === 'hide') {
    order.splice(i, 1);
    await supabase.from('videos').update({ status: 'hidden', rank: null, hidden_reason: 'hidden by staff' }).eq('id', p.data.id);
  } else if (i > 0) [order[i - 1], order[i]] = [order[i], order[i - 1]];
  // Renumber 1 to n in the new order; the first is the primary (is_primary is computed from rank).
  for (const [n, id] of order.entries())
    await supabase
      .from('videos')
      .update({ rank: n + 1 })
      .eq('id', id);
  revalidatePath('/admin/videos');
  return { ok: t('review.saved') };
}

// Find a video for dishes that have none: one YouTube search per dish, the top embeddable result is approved as the primary.
// Staff can hide a wrong one afterwards. A few dishes per click keeps the search quota and the 300 second limit safe.
export async function findVideos(): Promise<Msg> {
  const { supabase, user } = await requireStaff();
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return { error: t('videos.noKey') };
  const [{ data: comps }, { data: have }] = await Promise.all([
    supabase.from('components').select('id, name').order('name'),
    supabase.from('videos').select('component_id').eq('status', 'approved'),
  ]);
  const done = new Set((have ?? []).map((v) => v.component_id as string));
  const todo = (comps ?? []).filter((c) => !done.has(c.id as string)).slice(0, C.VIDEO_FIND_PER_RUN);
  let added = 0;
  for (const c of todo) {
    const [v] = await searchVideos(`${c.name} recipe how to cook Nigerian`, key);
    if (!v) continue;
    const { error } = await supabase.from('videos').insert({
      component_id: c.id,
      youtube_id: v.id,
      title: v.title,
      channel_title: v.channel,
      thumbnail_url: v.thumbnail,
      rank: 1,
      status: 'approved',
      approved_by: user.id,
      last_checked_at: new Date().toISOString(),
    });
    if (!error) added++;
  }
  revalidatePath('/admin/videos');
  return { ok: t('videos.found', { added, left: Math.max(0, (comps?.length ?? 0) - done.size - added) }) };
}
