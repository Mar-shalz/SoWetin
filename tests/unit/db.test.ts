import { readdirSync, readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { seedSql, validateSeed } from '@/lib/catalogue/seed';
import type { CatalogueSeed, IngredientsSeed } from '@/lib/catalogue/types';

const root = (f: string) => new URL(`../../${f}`, import.meta.url);
const cat: CatalogueSeed = JSON.parse(readFileSync(root('data/catalogue-seed.json'), 'utf8'));
const ing: IngredientsSeed = JSON.parse(readFileSync(root('data/ingredients-seed.json'), 'utf8'));

describe('seeds', () => {
  it('every reference resolves (pnpm seed:validate)', () => expect(validateSeed(cat, ing)).toEqual([]));
  it('supabase/seed.sql is current (run pnpm seed:import after changing the seeds)', () => {
    expect(readFileSync(root('supabase/seed.sql'), 'utf8')).toBe(seedSql(cat, ing));
  });
});

// "Migrations on a fresh database" (doc 06, section 11), on in-memory Postgres so CI needs no Docker.
describe('migrations and seed on a fresh database', () => {
  it('apply cleanly, load the seeds, and load again without duplicates', async () => {
    const db = new PGlite();
    await db.exec(readFileSync(root('tests/fixtures/auth-stub.sql'), 'utf8'));
    for (const f of readdirSync(root('supabase/migrations')).sort()) await db.exec(readFileSync(root(`supabase/migrations/${f}`), 'utf8'));
    const seed = readFileSync(root('supabase/seed.sql'), 'utf8');
    await db.exec(seed);
    await db.exec(seed);
    const count = async (t: string) => (await db.query<{ n: number }>(`select count(*)::int as n from ${t}`)).rows[0].n;
    expect(await count('components')).toBe(cat.components.length);
    expect(await count('ingredients')).toBe(ing.ingredients.length);
    expect(await count('pairings')).toBe(cat.pairings.length);
    expect(await count('plate_templates')).toBe(cat.plate_templates.length);
    expect(await count('component_ingredients')).toBe(cat.components.reduce((n, c) => n + c.ingredient_lines.length, 0));
    const rls = await db.query<{ n: number }>(`select count(*)::int as n from pg_tables where schemaname = 'public' and not rowsecurity`);
    expect(rls.rows[0].n).toBe(0);
    await db.close();
  }, 60_000);
});
