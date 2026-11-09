import { describe, expect, it } from 'vitest';
import { EMPTY, parseCraving, prePass, scrub, type Vocab } from '@/lib/ai/craving';

const vocab: Vocab = {
  tags: ['filling', 'light', 'peppery', 'soupy'],
  dishes: [
    { id: 'egusi-soup', names: ['Egusi soup', 'obe egusi'] },
    { id: 'amala', names: ['Àmàlà'] },
    { id: 'tomato-stew', names: ['Tomato stew', 'stew'] },
    { id: 'ewa-agoyin', names: ['Ewa agoyin', 'beans'] },
  ],
  plateTypes: ['soup_swallow', 'rice_plate'],
  cooked: [{ id: 'tomato-stew', names: ['Tomato stew', 'stew'] }],
  ingredients: [
    { id: 'yam', names: ['Yam'] },
    { id: 'eggs', names: ['Egg'] },
  ],
};

describe('craving pre-pass (doc 03, 7.1)', () => {
  it('reads money the ways people write it', () => {
    for (const [text, ngn] of [
      ['swallow under ₦2,000', 2000],
      ['2k abeg', 2000],
      ['rice for 2.5k', 2500],
      ['N2000 something', 2000],
      ['two thousand naira chop', 2000],
      ['1500 naira', 1500],
    ] as const)
      expect(prePass(text, vocab).budget_ngn, text).toBe(ngn);
    expect(prePass('something light', vocab).budget_ngn).toBeNull();
  });

  it('reads people, and leaves "the family" for the person to set', () => {
    expect(prePass('breakfast for 4, no beans', vocab).people).toBe(4);
    expect(prePass('food for two', vocab).people).toBe(2);
    expect(prePass('me and my sister', vocab).people).toBe(2);
    expect(prePass('for the family', vocab).people).toBeNull();
    expect(prePass('rice for 2k', vocab).people).toBeNull();
  });

  it('matches dish names with or without accents, and house items only when the text says so', () => {
    expect(prePass('amala and egusi soup', vocab).include_components).toEqual(['egusi-soup', 'amala']);
    expect(prePass('I get stew and 2 eggs', vocab)).toMatchObject({ include_components: [], have_cooked: ['tomato-stew'], have_ingredients: ['eggs'] });
    expect(prePass('yam and egg sauce', vocab).have_ingredients).toEqual([]);
    expect(prePass('breakfast for 4, no beans', vocab)).toMatchObject({ include_components: [], exclude_components: ['ewa-agoyin'] });
    expect(prePass('small yam, 2 eggs', vocab, true)).toMatchObject({ have_ingredients: ['yam', 'eggs'], include_components: [] });
  });

  it('takes emails and phone numbers out before anything goes to the AI', () => {
    expect(scrub('call 0803 123 4567 or a@b.com for 5000 10000')).toBe('call [number] or [email] for 5000 10000');
  });
});

describe('craving parse with the AI', () => {
  const answer = (json: object) =>
    (async () => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] }, finishReason: 'STOP' }] })) as unknown as typeof fetch;
  const ai = { key: 'k', model: 'm', timeoutMs: 1000 };
  const scene = { budget_ngn: 3500, people: 1, mode: 'cook' as const };

  it('keeps the code reading of money and people, and the AI reading of the rest', async () => {
    const r = await parseCraving('swallow under 2k, something peppery', vocab, scene, ai, false, answer({
      ...EMPTY,
      budget_ngn: 5000,
      boost_tags: ['peppery'],
      plate_types: ['soup_swallow'],
      language_detected: 'en',
      confidence: 0.9,
    }));
    expect(r.source).toBe('ai');
    expect(r.craving).toMatchObject({ budget_ngn: 2000, boost_tags: ['peppery'], plate_types: ['soup_swallow'] });
  });

  it('falls back to the pre-pass when the AI names something outside the catalogue', async () => {
    const r = await parseCraving('2k jollof', vocab, scene, ai, false, answer({ ...EMPTY, include_components: ['made-up-dish'] }));
    expect(r).toEqual({ source: 'prepass', craving: expect.objectContaining({ budget_ngn: 2000, include_components: [] }) });
  });

  it('falls back with no AI at all, and when the AI is down', async () => {
    expect((await parseCraving('2k', vocab, scene, null)).source).toBe('prepass');
    const down = (async () => new Response('busy', { status: 429 })) as unknown as typeof fetch;
    expect((await parseCraving('2k', vocab, scene, ai, false, down)).craving.budget_ngn).toBe(2000);
  });
});
