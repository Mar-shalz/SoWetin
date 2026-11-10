import { cookies } from 'next/headers';
import { z } from 'zod';
import { askChef, type ChefIngredient } from '@/lib/ai/chef';
import { publicAi } from '@/lib/ai/public';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { LOCALE_COOKIE } from '@/lib/i18n/request';
import { pidginExamples } from '@/lib/i18n/style';
import { catalogueForRequest } from '@/lib/plates/serve';
import { error } from '@/lib/plates/request';
import { cookServings } from '@/lib/pricing/costPlate';

// POST /api/v1/chef (S-019): one question about one dish. Published dishes only (staff with the second factor also see
// drafts). The answer is AI; the allergy warning and the trust line around it are fixed copy on the phone.
// shortcut: one answer at a time, not streamed, with a "Chef is thinking" state (doc 03, 7.2 allows it); not logged to
// ai_calls, which takes a server key or anonymous profiles.
const Body = z
  .object({
    component_id: z.string().regex(/^[a-z0-9-]{1,80}$/),
    question: z.string().trim().min(1).max(C.CHEF_QUESTION_MAX_CHARS),
    people: z.int().min(C.PEOPLE_MIN).max(C.PEOPLE_MAX),
  })
  .strict();
const reply = (body: object) => Response.json(body, { headers: { 'cache-control': 'no-store' } });
const amount = (n: number) => (n >= 10 ? Math.round(n) : Math.round(n * 10) / 10);

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error(400, 'VALIDATION_FAILED', 'Invalid request');
  const { component_id: id, question, people } = parsed.data;
  const ai = C.CHEF_ENABLED ? publicAi(request.headers, C.AI_CHEF_TIMEOUT_MS) : null;
  if (!ai) return reply({ state: 'busy' });

  const { cat, client } = await catalogueForRequest();
  const comp = cat?.snap.components.get(id);
  if (!cat || !client || !comp) return error(404, 'NOT_FOUND', 'Dish not found');
  const { data } = await client.from('component_steps').select('step_no, text, cue, heat').eq('component_id', id).order('step_no');
  const servings = cookServings({ id, batchServingsMin: comp.batchServingsMin, lines: [] }, people);
  const unit = (ing: string) => cat.book.ingredients[ing]?.canonicalUnit ?? 'g';
  const display = cat.display.get(id);

  const catalogue = new Map<string, ChefIngredient>(
    [...cat.snap.ingredients.values()].map((i) => [i.id, { id: i.id, name: cat.names.get(i.id) ?? i.id, allergens: i.allergens, mayContain: i.mayContain }]),
  );
  const allergens = [...new Set([...cat.snap.ingredients.values()].flatMap((i) => [...i.allergens, ...i.mayContain]))].sort();
  const asked = (await cookies()).get(LOCALE_COOKIE)?.value;
  const r = await askChef(
    question,
    {
      name: comp.name,
      localNames: [display?.localName ?? '', ...(display?.aliases ?? [])].filter(Boolean),
      servings,
      lines: comp.lines.map((l) => ({
        id: l.ingredientId,
        optional: l.optional,
        amount: l.qtyPerServing === null ? null : `${amount(l.qtyPerServing * servings)} ${unit(l.ingredientId)}`,
      })),
      steps: (data ?? []) as { text: string; cue: string | null; heat: string | null }[],
    },
    catalogue,
    allergens,
    [], // shortcut: no avoid or allergy lists until profiles (M3); askChef filters swaps against them once they exist
    C.PIDGIN_ENABLED && asked === 'pcm' ? { code: 'pcm', examples: pidginExamples() } : { code: 'en-NG' },
    ai,
  );
  if (!r.ok) return reply({ state: r.reason });
  const name = (ing: string) => catalogue.get(ing)?.name ?? ing;
  return reply({
    state: 'ok',
    answer: r.chef.answer,
    declined: r.chef.declined,
    substitutions: r.chef.substitutions.map((s) => ({ ...s, replace_name: name(s.replace), with_name: name(s.with) })),
    new_allergens: r.chef.newAllergens,
  });
}
