import { z } from 'zod';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { suggest } from '@/lib/engine/select';
import { mealTimeAt } from '@/lib/engine/time';
import type { Context } from '@/lib/engine/types';
import { catalogueForRequest, costFn, lagosToday, parsePlateKey, plateView } from '@/lib/plates/serve';

// POST /api/v1/suggestions (doc 07, section 4): a deck, or one plate with deck_size 1.
// shortcut: no profile yet, so no taste signals, avoid list, allergies or house items; those arrive with accounts (M3).
const Body = z
  .object({
    budget_ngn: z.int().min(C.BUDGET_MIN).max(C.BUDGET_MAX),
    people: z.int().min(C.PEOPLE_MIN).max(C.PEOPLE_MAX),
    mode: z.enum(['cook', 'buy']),
    deck_size: z.int().min(1).max(C.DECK_SIZE).default(C.DECK_SIZE),
    exclude_plate_keys: z.array(z.string().max(400)).max(60).default([]),
  })
  .strict();

const error = (status: number, code: string, message: string) =>
  Response.json({ error: { code, message } }, { status, headers: { 'cache-control': 'no-store' } });

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
  const now = new Date();
  const lagosDay = new Intl.DateTimeFormat('en-GB', { timeZone: C.TIMEZONE, weekday: 'short' }).format(now);
  const house = { cooked: [], foodstuff: [], basic: [] };
  const excludeMains = b.exclude_plate_keys.flatMap((k) => {
    const p = parsePlateKey(k, cat);
    const tpl = p && cat.snap.templates.find((t) => t.key === p.template);
    return (tpl && p?.slots[tpl.mainSlot]) ?? [];
  });
  const ctx: Context = {
    now: now.toISOString(),
    mealTime: mealTimeAt(now, C.MEAL_WINDOWS, C.TIMEZONE),
    weekend: lagosDay === 'Sat' || lagosDay === 'Sun',
    budget: b.budget_ngn,
    people: b.people,
    filters: {},
    avoid: { ingredients: [], allergens: [] },
    allergy: { ingredients: [], allergens: [], seasoningCubesOk: false },
    house,
    excludeMains,
    signals: { affinities: {}, count: 0, ateAt: {}, dislikedUntil: {}, lastPositiveAt: {}, seenMains: [] },
    seed: request_id,
  };
  const deck = suggest(cat.snap, ctx, costFn(cat, b.people, house, lagosToday()), C, b.deck_size);
  const plates = deck.plates.map((sp) => plateView(sp, cat, ctx));
  const state = plates.length ? (deck.tight ? 'tight' : 'ok') : excludeMains.length ? 'none_left' : 'empty';
  return reply({ state, meal_time: ctx.mealTime, staff_preview: staff && plates.some((p) => p.slots.some((s) => s.component.draft)), plates });
}
