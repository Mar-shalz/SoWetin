import { describe, expect, it, vi } from 'vitest';
import { catalogueHealth } from '@/lib/db/health';

const env = { NEXT_PUBLIC_SUPABASE_URL: 'https://db.example', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' };
const reply = (body: unknown, ok = true) => vi.fn(async () => ({ ok, json: async () => body }) as Response);

describe('catalogueHealth', () => {
  it('reads the counts with the public key only', async () => {
    const fetchFn = reply({ published: 0, ingredients: 145, price_points: 0 });
    expect(await catalogueHealth(env, fetchFn)).toEqual({ published: 0, ingredients: 145, price_points: 0 });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://db.example/rest/v1/rpc/catalogue_health');
    expect(init.headers).toEqual({ apikey: 'sb_publishable_test' });
  });

  it('gives up quietly when the database is missing, failing or answering nonsense', async () => {
    expect(await catalogueHealth({}, reply({}))).toBeNull();
    expect(await catalogueHealth(env, reply({ message: 'error' }, false))).toBeNull();
    expect(await catalogueHealth(env, reply({ unexpected: true }))).toBeNull();
    expect(
      await catalogueHealth(
        env,
        vi.fn(async () => Promise.reject(new Error('timeout'))),
      ),
    ).toBeNull();
  });
});
