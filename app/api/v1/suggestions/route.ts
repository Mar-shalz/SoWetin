import { z } from 'zod';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { suggest } from '@/lib/engine/select';
import { catalogueForRequest, costFn, lagosToday, parsePlateKey, plateView } from '@/lib/plates/serve';
import { contextFor, error, Scene } from '@/lib/plates/request';

// POST /api/v1/suggestions (doc 07, section 4): a deck, or one plate with deck_size 1.
const Body = Scene.extend({
  deck_size: z.int().min(1).max(C.DECK_SIZE).default(C.DECK_SIZE),
  exclude_plate_keys: z.array(z.string().max(400)).max(60).default([]),
}).strict();

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error(400, 'VALIDATION_FAILED', parsed.error.issues[0]?.message ?? 'Invalid request');
  const b = parsed.data;
  const request_id = crypto.randomUUID();
  const reply = (body: object) => Response.json({ request_id, ...body }, { headers: { 'cache-control': 'no-store' } });
  // Buy mode prices come from partner offers (doc 04, section 4.5), which aren't connected yet.
  if (b.mode === 'buy') return reply({ state: 'buy_unavailable', plates: [] });

  const { cat, staff } = await catalogueForRequest();
  if (!cat) return error(502, 'INTERNAL', 'Catalogue unavailable');
  const excludeMains = b.exclude_plate_keys.flatMap((k) => {
    const p = parsePlateKey(k, cat);
    const tpl = p && cat.snap.templates.find((t) => t.key === p.template);
    return (tpl && p?.slots[tpl.mainSlot]) ?? [];
  });
  const ctx = contextFor(b, cat, request_id, excludeMains);
  const deck = suggest(cat.snap, ctx, costFn(cat, b.people, ctx.house, lagosToday()), C, b.deck_size);
  const plates = deck.plates.map((sp) => plateView(sp, cat, ctx));
  const state = plates.length ? (deck.tight ? 'tight' : 'ok') : excludeMains.length ? 'none_left' : 'empty';
  return reply({ state, meal_time: ctx.mealTime, staff_preview: staff && plates.some((p) => p.slots.some((s) => s.component.draft)), plates });
}
