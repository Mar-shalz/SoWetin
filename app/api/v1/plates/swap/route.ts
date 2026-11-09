import { z } from 'zod';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { swapSlot } from '@/lib/engine/swap';
import { catalogueForRequest, costFn, lagosToday, plateView, scoredFromKey } from '@/lib/plates/serve';
import { contextFor, error, Scene } from '@/lib/plates/request';

// POST /api/v1/plates/swap (doc 07, section 4): the best other choice for one slot; every other slot stays (A-26).
const Body = Scene.extend({
  plate_key: z.string().max(400),
  slot: z.string().regex(/^[a-z_]{1,40}$/),
  shown_for_slot: z
    .array(z.string().regex(/^[a-z0-9-]{1,80}$/))
    .max(60)
    .default([]),
}).strict();

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error(400, 'VALIDATION_FAILED', parsed.error.issues[0]?.message ?? 'Invalid request');
  const b = parsed.data;
  if (b.mode === 'buy') return error(400, 'VALIDATION_FAILED', 'Swap is for cooking plates');
  const { cat } = await catalogueForRequest();
  if (!cat) return error(502, 'INTERNAL', 'Catalogue unavailable');
  const ctx = contextFor(b, cat, crypto.randomUUID());
  const cost = costFn(cat, b.people, ctx.house, lagosToday());
  const current = scoredFromKey(b.plate_key, cat, cost, b.budget_ngn);
  if (!current) return error(404, 'NOT_FOUND', 'Unknown plate');
  const next = swapSlot(cat.snap, ctx, current, b.slot, cost, C, b.shown_for_slot);
  const headers = { 'cache-control': 'no-store' };
  return next ? Response.json({ plate: plateView(next, cat, ctx) }, { headers }) : Response.json({ plate: null, reason: 'none_fits' }, { headers });
}
