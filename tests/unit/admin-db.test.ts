import { readdirSync, readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Admin rules live in the database (migration 20261109020000_admin.sql), so they are tested here, on real Postgres.
const root = (f: string) => new URL(`../../${f}`, import.meta.url);
const EDITOR = '00000000-0000-4000-8000-000000000001';
const STRANGER = '00000000-0000-4000-8000-000000000002';
const DISH = 'egusi-soup';
type Who = 'anon' | { sub: string; aal: 'aal1' | 'aal2' };
const editor: Who = { sub: EDITOR, aal: 'aal2' };

let db: PGlite;

// Runs sql the way PostgREST does for a request: the API role plus that person's JWT claims, in one transaction.
async function as<T = Record<string, unknown>>(who: Who, sql: string, params: unknown[] = []): Promise<T[]> {
  return db.transaction(async (tx) => {
    if (who === 'anon') await tx.exec('set local role anon');
    else {
      await tx.exec('set local role authenticated');
      const claims = JSON.stringify({ sub: who.sub, aal: who.aal, role: 'authenticated' });
      await tx.query(`select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)`, [claims, who.sub]);
    }
    return (await tx.query<T>(sql, params)).rows;
  });
}
const count = async (who: Who, from: string) => (await as<{ n: number }>(who, `select count(*)::int as n from ${from}`))[0].n;
const apply = (who: Who, m: object) => as(who, 'select public.apply_method($1, $2)', [DISH, JSON.stringify(m)]);
const blockers = async () => (await as<{ b: string[] }>(editor, 'select public.publish_blockers(c) as b from components c where id = $1', [DISH]))[0].b;
const setStatus = (who: Who, status: string) => as(who, 'update components set status = $1 where id = $2', [status, DISH]);
const version = async () => (await db.query<{ v: number }>('select coalesce(max(version), 1)::int as v from snapshot_version')).rows[0].v;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync(root('tests/fixtures/auth-stub.sql'), 'utf8'));
  for (const f of readdirSync(root('supabase/migrations')).sort()) await db.exec(readFileSync(root(`supabase/migrations/${f}`), 'utf8'));
  await db.exec(readFileSync(root('supabase/seed.sql'), 'utf8'));
  await db.exec(`insert into auth.users (id) values ('${EDITOR}'), ('${STRANGER}'); insert into user_roles values ('${EDITOR}', 'editor');`);
}, 60_000);
afterAll(() => db.close());

describe('admin rules in the database', () => {
  it('shows drafts only to staff who passed the second factor', async () => {
    expect(await count('anon', 'components')).toBe(0);
    expect(await count({ sub: STRANGER, aal: 'aal2' }, 'components')).toBe(0);
    expect(await count({ sub: EDITOR, aal: 'aal1' }, 'components')).toBe(0);
    expect(await count(editor, 'components')).toBe(135);
    expect(await count(editor, 'component_ingredients')).toBeGreaterThan(800);
    expect(await count({ sub: STRANGER, aal: 'aal2' }, 'user_roles')).toBe(0);
    expect(await count(editor, 'user_roles')).toBe(1);
  });

  it('lets only staff with the second factor write, and never anon', async () => {
    await expect(apply({ sub: STRANGER, aal: 'aal2' }, { storage: 'x' })).rejects.toThrow(/not found/);
    await expect(apply({ sub: EDITOR, aal: 'aal1' }, { storage: 'x' })).rejects.toThrow(/not found/);
    await expect(apply('anon', { storage: 'x' })).rejects.toThrow(/permission denied/);
    await expect(as('anon', 'select public.publish_blockers(c) from components c')).rejects.toThrow(/permission denied/);
  });

  it('blocks publishing until BR-41 is met, then stamps it and bumps the snapshot', async () => {
    expect(await blockers()).toEqual(['illustration', 'times', 'quantities', 'steps', 'tips', 'mistakes', 'storage', 'tested']);

    const lines = (await db.query<{ id: string }>('select ingredient_id as id from component_ingredients where component_id = $1', [DISH])).rows;
    await apply(editor, {
      prep_minutes: '20',
      ingredients: lines.map((l) => ({ ingredient_id: l.id, qty_per_serving: '10', grp: 'base' })),
      steps: [
        { text: 'Heat the palm oil.', cue: 'It shimmers.', heat: 'medium' },
        { text: 'Stir in the egusi.', cue: 'It smells toasted.', heat: 'low' },
      ],
      tips: ['Toast the egusi well.'],
      mistakes: ["Don't rush the frying, or it tastes raw."],
      storage: '3 days in the fridge.',
    });
    expect(await blockers()).toEqual(['illustration', 'tested']);
    await expect(setStatus(editor, 'published')).rejects.toThrow('Not ready to publish: illustration, tested');

    await apply(editor, { tested_at: '2026-11-09' });
    await as(editor, `update components set illustration_path = 'egusi-soup.webp' where id = $1`, [DISH]);
    const before = await version();
    await setStatus(editor, 'published');
    const [row] = await as<{ reviewed_by: string; tested_by: string; published_at: string | null }>(
      editor,
      'select reviewed_by, tested_by, published_at from components where id = $1',
      [DISH],
    );
    expect(row).toMatchObject({ reviewed_by: EDITOR, tested_by: EDITOR });
    expect(row.published_at).not.toBeNull();
    expect(await version()).toBe(before + 1);
    expect(await count('anon', 'components')).toBe(1);
    expect(await count('anon', 'component_steps')).toBe(2);
  });

  it('freezes a published dish until it is unpublished', async () => {
    await expect(apply(editor, { storage: 'changed' })).rejects.toThrow(/Unpublish egusi-soup/);
    await expect(as(editor, `insert into component_steps (component_id, step_no, text) values ($1, 9, 'Serve.')`, [DISH])).rejects.toThrow(
      /Unpublish egusi-soup/,
    );
    const before = await version();
    await setStatus(editor, 'draft');
    expect(await version()).toBe(before + 1);
    expect(await count('anon', 'components')).toBe(0);
  });

  it('needs a cue on every step that has a heat', async () => {
    await apply(editor, { steps: [{ text: 'Fry the onion.', heat: 'medium' }] });
    expect(await blockers()).toContain('cues');
  });

  it('records who changed what in the audit log', async () => {
    const rows = (await db.query<{ actor: string; action: string; entity: string }>(`select actor, action, entity from audit_log where entity_id = $1`, [DISH]))
      .rows;
    expect(rows.some((r) => r.actor === EDITOR && r.entity === 'components' && r.action === 'update')).toBe(true);
    expect(rows.some((r) => r.actor === EDITOR && r.entity === 'component_steps' && r.action === 'insert')).toBe(true);
  });

  it('lets staff log their own AI draft calls only', async () => {
    const call = (who: Who, sub: string) =>
      as(who, `insert into ai_calls (task, model, prompt_version, user_id, outcome) values ('draft', 'test', 't3-v1', $1, 'ok')`, [sub]);
    await call(editor, EDITOR);
    await expect(call(editor, STRANGER)).rejects.toThrow(/row-level security/);
    await expect(call({ sub: STRANGER, aal: 'aal2' }, STRANGER)).rejects.toThrow(/row-level security/);
  });
});

describe('price rules in the database (A-04)', () => {
  const ADMIN = '00000000-0000-4000-8000-000000000003';
  const admin: Who = { sub: ADMIN, aal: 'aal2' };
  const observe = (who: Who, by: string) =>
    as(
      who,
      `insert into price_observations (ingredient_id, area_id, unit_label, unit_canonical_qty, price_ngn, observed_on, source, created_by)
       values ('palm-oil', 'lagos', '1 litre', 1000, 2500, '2026-11-20', 'retail_survey', $1)`,
      [by],
    );

  it('lets only an admin with the second factor import and rebuild prices', async () => {
    await db.exec(`insert into auth.users (id) values ('${ADMIN}'); insert into user_roles values ('${ADMIN}', 'admin');`);
    await expect(observe(editor, EDITOR)).rejects.toThrow(/row-level security/);
    await expect(observe({ sub: ADMIN, aal: 'aal1' }, ADMIN)).rejects.toThrow(/row-level security/);
    await expect(observe(admin, EDITOR)).rejects.toThrow(/row-level security/);
    await observe(admin, ADMIN);
    expect(await count(editor, 'price_observations')).toBe(0);
    expect(await count(admin, 'price_observations')).toBe(1);
    const point = `insert into price_points (ingredient_id, area_id, per_unit_low, per_unit_mid, per_unit_high, confidence, as_of, oldest, sample_count, source_count)
                   values ('palm-oil', 'lagos', 2, 2.5, 3, 'low', '2026-11-20', '2026-11-20', 1, 1)`;
    await expect(as(editor, point)).rejects.toThrow(/row-level security/);
    await as(admin, point);
    expect(await count('anon', 'price_points')).toBe(1);
    const logged = (
      await db.query<{ n: number }>(`select count(*)::int as n from audit_log where entity in ('price_observations', 'price_points') and actor = $1`, [ADMIN])
    ).rows[0].n;
    expect(logged).toBe(2);
  });
});
