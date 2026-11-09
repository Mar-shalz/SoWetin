import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { methodFromForm } from '@/lib/admin/method';
import { geminiJson, geminiSchema } from '@/lib/ai/gemini';
import { draftSchema, methodFromDraft, t3Draft, t3Prompt, type T3Dish } from '@/lib/ai/t3';

const form = (entries: [string, string][]) => {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
};
const base: [string, string][] = [
  ['total_minutes', '60'],
  ['line', 'palm-oil'],
  ['line.palm-oil.qty', '30'],
  ['line.palm-oil.grp', 'oil'],
  ['line.palm-oil.note', ''],
];

describe('review form (A-03)', () => {
  it('turns the flat fields into a method, dropping empty rows and typing timers in minutes', () => {
    const r = methodFromForm(
      form([
        ...base,
        ['local_names.yo', 'obe egusi'],
        ['local_names.ig', ''],
        ['aliases', 'egusi, agushi ,'],
        ['step_text', 'Heat the oil.'],
        ['step_cue', 'It shimmers.'],
        ['step_heat', 'medium'],
        ['step_timer', '2.5'],
        ['step_tip', ''],
        ['step_text', ''],
        ['step_cue', ''],
        ['step_heat', ''],
        ['step_timer', ''],
        ['step_tip', ''],
        ['tip', 'Toast the egusi.'],
        ['tip', ''],
        ['mistake', ''],
      ]),
    );
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({
      local_names: { yo: 'obe egusi' },
      aliases: ['egusi', 'agushi'],
      prep_minutes: '',
      total_minutes: 60,
      ingredients: [{ ingredient_id: 'palm-oil', qty_per_serving: 30, grp: 'oil', note: '' }],
      steps: [{ text: 'Heat the oil.', cue: 'It shimmers.', heat: 'medium', timer_seconds: 150, tip: '' }],
      tips: ['Toast the egusi.'],
      mistakes: [],
    });
  });

  it('rejects values the database would refuse', () => {
    expect(methodFromForm(form([...base, ['step_text', 'Fry it.'], ['step_heat', 'scorching']])).success).toBe(false);
    expect(methodFromForm(form([...base.slice(0, 2), ['line.palm-oil.qty', 'lots']])).success).toBe(false);
    expect(methodFromForm(form([['total_minutes', '0']])).success).toBe(false);
    expect(methodFromForm(form([...base, ['line', 'not a slug!']])).success).toBe(false);
  });
});

const dish: T3Dish = {
  id: 'egusi-soup',
  name: 'Egusi soup',
  types: ['soup'],
  region: 'yoruba',
  cuisine_family: 'nigerian',
  local_names: { yo: 'obe egusi' },
  aliases: [],
  total_minutes: 60,
  batch_servings_min: 4,
  equipment: [],
  component_ingredients: [
    { ingredient_id: 'egusi-ground', optional: false, ingredients: { name: 'Ground egusi', canonical_unit: 'g' } },
    { ingredient_id: 'iru', optional: true, ingredients: { name: 'Iru', canonical_unit: 'g' } },
  ],
};
const good = {
  local_names: { yo: 'ọbẹ̀ ẹ̀gúsí' },
  aliases: ['egusi'],
  description: 'A rich soup of ground melon seeds. Lagos eats it with swallow.',
  prep_minutes: 20,
  total_minutes: 60,
  ingredients: [
    { ingredient_id: 'egusi-ground', qty_per_serving: 50, grp: 'base' },
    { ingredient_id: 'iru', qty_per_serving: 3, grp: 'seasoning' },
  ],
  steps: [
    { text: 'Heat the palm oil.', cue: 'It shimmers.', heat: 'medium' },
    { text: 'Stir in the egusi.', cue: 'It smells toasted.', heat: 'low', timer_seconds: 600 },
  ],
  tips: ['Toast the egusi well.'],
  mistakes: ["Don't add the leaves early, because they go dull."],
  storage: '3 days in the fridge, 1 month frozen. Reheat gently.',
  serving_note: 'Eba or pounded yam.',
  reviewer_notes: 'Most cooks also add crayfish.',
};
const gemini = (body: unknown, status = 200) => vi.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));
const answer = (json: unknown, finishReason = 'STOP') => ({
  candidates: [{ content: { parts: [{ text: 'thinking', thought: true }, { text: JSON.stringify(json) }] }, finishReason }],
  usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 700, thoughtsTokenCount: 300 },
});
const opts = { key: 'test-key', model: 'gemini-test', timeoutMs: 1000 };

describe('T3 drafts on Gemini (doc 03, 7.3)', () => {
  it('sends the writing standard, a JSON schema limited to the dish lines, and the key only in a header', async () => {
    const fetchFn = gemini(answer(good));
    const r = await t3Draft(dish, opts, fetchFn);
    expect(r).toMatchObject({ ok: true, draft: good, usage: { input: 900, output: 1000 } });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent');
    expect(url).not.toContain('test-key');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key');
    const body = JSON.parse(String(init.body));
    expect(body.systemInstruction.parts[0].text).toContain('Every cooking step has a cue');
    const schema = body.generationConfig.responseJsonSchema;
    expect(schema.properties.ingredients.items.properties.ingredient_id.enum).toEqual(['egusi-ground', 'iru']);
    expect(JSON.stringify(schema)).not.toMatch(/additionalProperties|maxLength|\$schema/);
    expect(t3Prompt(dish)).toContain('- iru: Iru, in g (optional)');
  });

  it('never keeps an answer that names an unknown ingredient or breaks the schema', async () => {
    const stranger = { ...good, ingredients: [{ ingredient_id: 'pork', qty_per_serving: 50, grp: 'protein' }] };
    expect(await t3Draft(dish, opts, gemini(answer(stranger)))).toMatchObject({ ok: false, reason: 'invalid' });
    expect(await t3Draft(dish, opts, gemini(answer({ ...good, steps: [] })))).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('reports quota, refusals, bad JSON and network failures without throwing', async () => {
    const call = (f: typeof fetch) => geminiJson({ ...opts, system: 's', prompt: 'p', schema: {} }, f);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await call(gemini({ error: { code: 429 } }, 429))).toMatchObject({ ok: false, reason: 'quota' });
    expect(await call(gemini({ error: { code: 400 } }, 400))).toMatchObject({ ok: false, reason: 'failed' });
    expect(await call(gemini(answer(good, 'SAFETY')))).toMatchObject({ ok: false, reason: 'stopped', stop: 'SAFETY' });
    expect(await call(gemini({ candidates: [{ content: { parts: [{ text: '{oops' }] }, finishReason: 'STOP' }] }))).toMatchObject({
      ok: false,
      reason: 'invalid',
    });
    expect(await call(vi.fn(async () => Promise.reject(new Error('offline'))))).toMatchObject({ ok: false, reason: 'failed' });
  });

  it('keeps only the JSON Schema words Gemini documents', () => {
    const s = geminiSchema(z.toJSONSchema(z.object({ description: z.string().max(5), n: z.int().min(1).optional() })));
    expect(s).toEqual({
      type: 'object',
      properties: { description: { type: 'string' }, n: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER } },
      required: ['description'],
    });
  });

  it('copies a draft into the dish without the reviewer notes or a kitchen test', () => {
    const m = methodFromDraft(good);
    expect(m).not.toBeNull();
    expect(m).not.toHaveProperty('reviewer_notes');
    expect(m).not.toHaveProperty('tested_at');
    expect(m?.steps).toHaveLength(2);
    expect(methodFromDraft({ nonsense: true })).toBeNull();
    expect(draftSchema().safeParse(good).success).toBe(true);
  });
});

describe('dish pictures (BR-41)', () => {
  it('knows a picture by its first bytes and refuses anything else', async () => {
    const { pictureType } = await import('@/lib/admin/picture');
    const bytes = (...xs: (number | string)[]) => new Uint8Array(xs.flatMap((x) => (typeof x === 'string' ? [...x].map((c) => c.charCodeAt(0)) : [x])));
    expect(pictureType(bytes(0x89, 'PNG', 0x0d, 0x0a))).toBe('image/png');
    expect(pictureType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(pictureType(bytes('RIFF', 0, 0, 0, 0, 'WEBPVP8 '))).toBe('image/webp');
    expect(pictureType(bytes(0, 0, 0, 0x20, 'ftypavif'))).toBe('image/avif');
    expect(pictureType(bytes('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(pictureType(bytes('<html><script>'))).toBeNull();
  });
});

describe('YouTube paste-in (A-05)', () => {
  it('reads the video id from every common link, and nothing else', async () => {
    const { youtubeId } = await import('@/lib/admin/youtube');
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://m.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://evil.example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(youtubeId('javascript:alert(1)')).toBeNull();
    expect(youtubeId('https://www.youtube.com/watch?v=short')).toBeNull();
  });

  it('takes title and channel from oEmbed, refuses unembeddable videos and foreign thumbnails', async () => {
    const { videoInfo } = await import('@/lib/admin/youtube');
    const ok = vi.fn(async () => Response.json({ title: 'Egusi soup', author_name: 'Sisi Yemmie', thumbnail_url: 'https://i.ytimg.com/vi/x/hqdefault.jpg' }));
    expect(await videoInfo('dQw4w9WgXcQ', ok)).toEqual({ title: 'Egusi soup', channel: 'Sisi Yemmie', thumbnail: 'https://i.ytimg.com/vi/x/hqdefault.jpg' });
    expect(
      await videoInfo(
        'dQw4w9WgXcQ',
        vi.fn(async () => new Response('Unauthorized', { status: 401 })),
      ),
    ).toBeNull();
    const odd = vi.fn(async () => Response.json({ title: 'x', author_name: 'y', thumbnail_url: 'https://evil.example.com/t.jpg' }));
    expect((await videoInfo('dQw4w9WgXcQ', odd))?.thumbnail).toBeNull();
  });
});
