import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { chefSchema } from '@/lib/ai/chef';
import { aiCravingSchema } from '@/lib/ai/craving';
import { geminiSchema } from '@/lib/ai/gemini';
import { draftSchema } from '@/lib/ai/t3';
import { extractSchema } from '@/lib/scout/run';

// Gemini answers 400 INVALID_ARGUMENT to a schema with an empty node or a null branch (seen live, 10 November 2026).
// Every schema we send must give each field a type, whatever the catalogue holds.
function problems(node: unknown, path = '$'): string[] {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return [];
  const o = node as Record<string, unknown>;
  const own = [...(Object.keys(o).length === 0 ? [`${path} is empty`] : []), ...('anyOf' in o ? [`${path} has anyOf`] : []), ...(!('type' in o) ? [`${path} has no type`] : [])];
  const props = Object.entries((o.properties as Record<string, unknown>) ?? {}).flatMap(([k, v]) => problems(v, `${path}.${k}`));
  return [...own, ...props, ...problems(o.items, `${path}[]`)];
}
const sent = (schema: z.ZodType) => problems(geminiSchema(z.toJSONSchema(schema)));

describe('schemas sent to Gemini', () => {
  it('give every field a type, with an empty or a full catalogue', () => {
    const empty = { tags: [], dishes: [], plateTypes: [], cooked: [], ingredients: [] };
    const full = { tags: ['light'], dishes: [{ id: 'eba', names: ['Eba'] }], plateTypes: ['soup_swallow'], cooked: [{ id: 'stew', names: ['Stew'] }], ingredients: [{ id: 'yam', names: ['Yam'] }] };
    expect(sent(aiCravingSchema(empty))).toEqual([]);
    expect(sent(aiCravingSchema(full))).toEqual([]);
    expect(sent(chefSchema([], [], []))).toEqual([]);
    expect(sent(chefSchema(['crayfish'], ['crayfish', 'smoked-catfish'], ['fish']))).toEqual([]);
    expect(sent(extractSchema(['rice']))).toEqual([]);
    expect(sent(draftSchema(['rice']))).toEqual([]);
  });
});
