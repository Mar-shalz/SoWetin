import { z } from 'zod';
import { parseCraving, type Vocab } from '@/lib/ai/craving';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { catalogueForRequest } from '@/lib/plates/serve';
import { error } from '@/lib/plates/request';
import { publicAi } from '@/lib/ai/public';

// POST /api/v1/craving (doc 03, 7.1; S-008 and the house sheet's "Anything else?", BR-134): what someone typed, read as
// filters and chips they can remove. Nothing here saves anything; the phone shows the chips and the person decides.
const Body = z
  .object({
    text: z.string().trim().min(1).max(C.CRAVING_MAX_CHARS),
    house: z.boolean().default(false),
    budget_ngn: z.int().min(C.BUDGET_MIN).max(C.BUDGET_MAX).optional(),
    people: z.int().min(C.PEOPLE_MIN).max(C.PEOPLE_MAX).optional(),
    mode: z.enum(['cook', 'buy']).optional(),
    meal_time: z.enum(['breakfast', 'lunch', 'dinner', 'late_night']).nullable().optional(),
  })
  .strict();

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error(400, 'VALIDATION_FAILED', 'Invalid request');
  const { text, house, ...scene } = parsed.data;
  const { cat } = await catalogueForRequest();
  if (!cat) return error(502, 'INTERNAL', 'Catalogue unavailable');

  const comps = [...cat.snap.components.values()];
  const names = (id: string, name: string) => {
    const d = cat.display.get(id);
    return [name, d?.localName ?? '', ...(d?.aliases ?? [])].filter(Boolean);
  };
  const vocab: Vocab = {
    tags: [...new Set(comps.flatMap((c) => c.tags))].sort(),
    dishes: comps.map((c) => ({ id: c.id, names: names(c.id, c.name) })),
    plateTypes: cat.snap.templates.map((t) => t.key),
    cooked: cat.house.cooked.map((h) => ({ id: h.id, names: names(h.id, h.name) })),
    ingredients: [...cat.house.foodstuff, ...cat.house.basic].map((h) => ({ id: h.id, names: [h.name] })),
  };
  const ai = C.CRAVING_AI_ENABLED ? publicAi(request.headers) : null;
  const { craving, source } = await parseCraving(text, vocab, scene, ai, house);

  // Names for the chips, from the catalogue only.
  const ids = [...craving.include_components, ...craving.exclude_components, ...craving.have_cooked, ...craving.have_ingredients];
  const label = (id: string) => cat.display.get(id)?.name ?? cat.names.get(id) ?? vocab.ingredients.find((i) => i.id === id)?.names[0];
  const labels = Object.fromEntries(ids.map((id) => [id, label(id) ?? id]));
  return Response.json({ craving, source, labels }, { headers: { 'cache-control': 'no-store' } });
}
