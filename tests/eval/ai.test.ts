import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { askChef, type ChefIngredient } from '@/lib/ai/chef';
import { parseCraving, type Vocab } from '@/lib/ai/craving';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { pidginExamples } from '@/lib/i18n/style';

// Doc 03, section 8: every case in data/ai-eval-cases.json against the live model, then the pass marks.
// The catalogue comes from the seeds, so it runs before anything is published.
// shortcut: the report goes to test-results/ai-eval.json, not ai_eval_runs; writing there needs a server key.
type Seed = { slug: string; name: string; tags: string[]; local_names: Record<string, string>; aliases: string[]; house_chip?: boolean; batch_servings_min?: number;
  ingredient_lines: { ingredient: string; optional: boolean; qty_per_serving: number | null }[]; steps: { text: string; cue?: string | null; heat?: string | null }[] };
type Ing = { slug: string; name: string; canonical_unit: string; allergens: string[]; may_contain: string[]; house_group: string | null };
type Case = { id: string; task: 'craving_parse' | 'chef_tips'; input: Record<string, unknown>; expect: Record<string, unknown> };
const read = <T,>(f: string) => JSON.parse(readFileSync(new URL(`../../data/${f}`, import.meta.url), 'utf8')) as T;
const seed = read<{ tag_vocabulary: string[]; plate_templates: { key: string }[]; components: Seed[] }>('catalogue-seed.json');
const ings = read<{ ingredients: Ing[] }>('ingredients-seed.json').ingredients;
const cases = read<{ cases: Case[] }>('ai-eval-cases.json').cases;
const DELAY_MS = 7000; // stays under the free tier's requests per minute
const PIDGIN = /\b(dey|wetin|una|abeg|don|fit|wan)\b/i;

const named = (c: Seed) => ({ id: c.slug, names: [c.name, ...Object.values(c.local_names ?? {}), ...(c.aliases ?? [])] });
const vocab: Vocab = {
  tags: seed.tag_vocabulary,
  dishes: seed.components.map(named),
  plateTypes: seed.plate_templates.map((t) => t.key),
  cooked: seed.components.filter((c) => c.house_chip).map(named),
  ingredients: ings.filter((i) => i.house_group).map((i) => ({ id: i.slug, names: [i.name] })),
};
const catalogue = new Map<string, ChefIngredient>(ings.map((i) => [i.slug, { id: i.slug, name: i.name, allergens: i.allergens, mayContain: i.may_contain }]));
const allergens = [...new Set(ings.flatMap((i) => [...i.allergens, ...i.may_contain]))].sort();

// One expectation against one answer: exact values, "_any" (one listed value present), "_none" (nothing found), any_of.
function check(out: Record<string, unknown>, e: Record<string, unknown>): string[] {
  const miss: string[] = [];
  for (const [k, want] of Object.entries(e)) {
    if (k === 'any_of') {
      if (!(want as Record<string, unknown>[]).some((alt) => !check(out, alt).length)) miss.push('any_of');
    } else if (k.endsWith('_any')) {
      const got = (out[k.slice(0, -4)] as string[] | undefined) ?? [];
      if (!(want as string[]).some((v) => got.includes(v))) miss.push(`${k}: got ${JSON.stringify(got)}`);
    } else if (k.endsWith('_none')) {
      if (((out[k.slice(0, -5)] as string[] | undefined) ?? []).length) miss.push(k);
    } else if (k === 'substitutions_must_not_include') {
      const withs = ((out.substitutions as { with: string }[] | undefined) ?? []).map((s) => s.with);
      if (withs.some((w) => (want as string[]).includes(w))) miss.push(`${k}: ${withs.join(', ')}`);
    } else if (k === 'with_must_be_catalogue_ingredient') {
      if (((out.substitutions as { with: string }[] | undefined) ?? []).some((s) => !catalogue.has(s.with))) miss.push(k);
    } else if (k === 'max_words') {
      if (String(out.answer ?? '').split(/\s+/).length > (want as number)) miss.push(k);
    } else if (k === 'answer_must_not_match') {
      if (new RegExp(want as string, 'i').test(String(out.answer ?? ''))) miss.push(k);
    } else if (k === 'answer_language') {
      if (want === 'pcm' && !PIDGIN.test(String(out.answer ?? ''))) miss.push(k);
    } else if (k === 'must_not_leak_prompt' || k === 'answer_must_be_food_only') {
      if (JSON.stringify(out).includes('You turn a hungry person')) miss.push(k); // the rest is judged by "declined" or "intent"
    } else if (JSON.stringify(out[k]) !== JSON.stringify(want)) miss.push(`${k}: got ${JSON.stringify(out[k])}`);
  }
  return miss;
}

const p95 = (ms: number[]) => [...ms].sort((a, b) => a - b)[Math.max(0, Math.ceil(ms.length * 0.95) - 1)] ?? 0;
const key = process.env.GEMINI_PUBLIC_API_KEY ?? process.env.GEMINI_API_KEY;

it.skipIf(!key)('meets the doc 03 pass marks', async () => {
  const ai = { key: key!, model: C.AI_MODEL_RUNTIME, timeoutMs: 15_000, thinking: C.AI_RUNTIME_THINKING };
  const results: { id: string; task: string; valid: boolean; ms: number; miss: string[]; e: Record<string, unknown> }[] = [];
  for (const c of cases) {
    const started = Date.now();
    let out: Record<string, unknown> = {};
    let valid = false;
    if (c.task === 'craving_parse') {
      const ctx = c.input.context as { budget_ngn: number; people: number; mode: 'cook' | 'buy'; meal_time: string };
      const r = await parseCraving(String(c.input.text), vocab, ctx, ai);
      valid = r.source === 'ai';
      out = r.craving as unknown as Record<string, unknown>;
    } else {
      const dish = seed.components.find((d) => d.slug === c.input.component_id)!;
      const people = Number(c.input.people);
      const servings = Math.max(people, dish.batch_servings_min ?? 1);
      const r = await askChef(
        String(c.input.question),
        {
          name: dish.name,
          localNames: Object.values(dish.local_names ?? {}),
          servings,
          lines: dish.ingredient_lines.map((l) => ({ id: l.ingredient, optional: l.optional, amount: l.qty_per_serving === null ? null : `${l.qty_per_serving * servings}` })),
          steps: (dish.steps ?? []).map((s) => ({ text: s.text, cue: s.cue ?? null, heat: s.heat ?? null })),
        },
        catalogue,
        allergens,
        (c.input.user_avoids as string[]) ?? [],
        c.input.ui_language === 'pcm' ? { code: 'pcm', examples: pidginExamples() } : { code: 'en-NG' },
        ai,
      );
      valid = r.ok;
      out = r.ok ? { ...r.chef } : {};
    }
    results.push({ id: c.id, task: c.task, valid, ms: Date.now() - started, miss: valid ? check(out, c.expect) : ['no valid answer'], e: c.expect });
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  const t1 = results.filter((r) => r.task === 'craving_parse');
  const t2 = results.filter((r) => r.task === 'chef_tips');
  const rate = (list: typeof results, pick: (r: (typeof results)[number]) => boolean, ok: (r: (typeof results)[number]) => boolean) => {
    const xs = list.filter(pick);
    return xs.length ? xs.filter(ok).length / xs.length : 1;
  };
  const marks = {
    schemaValid: rate(results, () => true, (r) => r.valid),
    t1BudgetPeople: rate(t1, (r) => 'budget_ngn' in r.e || 'people' in r.e, (r) => !r.miss.some((m) => /^(budget_ngn|people)/.test(m))),
    t1Intent: rate(t1, (r) => 'intent' in r.e, (r) => !r.miss.some((m) => m.startsWith('intent'))),
    t1Tags: rate(t1, (r) => 'boost_tags_any' in r.e, (r) => !r.miss.some((m) => m.startsWith('boost_tags_any'))),
    t2Avoid: rate(t2, (r) => 'substitutions_must_not_include' in r.e, (r) => !r.miss.some((m) => m.startsWith('substitutions_must_not_include'))),
    t2Declined: rate(t2, (r) => r.e.declined === true, (r) => !r.miss.some((m) => m.startsWith('declined'))),
    t1P95: p95(t1.map((r) => r.ms)),
    t2P95: p95(t2.map((r) => r.ms)),
  };
  mkdirSync(new URL('../../test-results/', import.meta.url), { recursive: true });
  writeFileSync(new URL('../../test-results/ai-eval.json', import.meta.url), JSON.stringify({ model: C.AI_MODEL_RUNTIME, marks, results }, null, 2));
  console.table(results.filter((r) => r.miss.length).map(({ id, miss }) => ({ id, miss: miss.join('; ') })));
  console.table(marks);
  expect(marks.schemaValid).toBe(1);
  expect(marks.t1BudgetPeople).toBeGreaterThanOrEqual(0.95);
  expect(marks.t1Intent).toBeGreaterThanOrEqual(0.95);
  expect(marks.t1Tags).toBeGreaterThanOrEqual(0.85);
  expect(marks.t2Avoid).toBe(1);
  expect(marks.t2Declined).toBe(1);
  expect(marks.t1P95).toBeLessThanOrEqual(C.AI_PARSE_TIMEOUT_MS);
  expect(marks.t2P95).toBeLessThanOrEqual(C.AI_CHEF_TIMEOUT_MS);
});
