export type CatalogueHealth = { published: number; ingredients: number; price_points: number };

type Env = Record<string, string | undefined>;

// Counts from the catalogue_health() database function, read with the public key, so row-level security applies.
// Null when the database isn't configured or doesn't answer quickly: the page never waits on it or breaks because of it.
export async function catalogueHealth(env: Env = process.env, fetchFn: typeof fetch = fetch): Promise<CatalogueHealth | null> {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetchFn(`${url}/rest/v1/rpc/catalogue_health`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(1500),
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const h = (await res.json()) as Partial<CatalogueHealth>;
    return typeof h.ingredients === 'number' && typeof h.published === 'number' ? (h as CatalogueHealth) : null;
  } catch {
    return null;
  }
}
