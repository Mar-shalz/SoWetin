import { requireStaff } from '@/lib/admin/guard';

// Raw price observations for one ingredient (?i=beans-white), so a wrong price point can be traced to its rows.
// shortcut: CSV only, no screen; a review screen comes with A-04 part two (doc 04, section 9).
export async function GET(req: Request) {
  const { supabase, role } = await requireStaff();
  if (role !== 'admin') return new Response('Admin only', { status: 403 });
  const id = new URL(req.url).searchParams.get('i') ?? '';
  const { data, error } = await supabase
    .from('price_observations')
    .select('id, area_id, unit_label, unit_canonical_qty, price_ngn, observed_on, market, source, source_url, source_quote, confirmed_outlier, excluded_reason')
    .eq('ingredient_id', id)
    .order('id');
  if (error) return new Response(error.message, { status: 500 });
  const cols = ['id', 'area_id', 'unit_label', 'unit_canonical_qty', 'price_ngn', 'observed_on', 'market', 'source', 'source_url', 'source_quote', 'confirmed_outlier', 'excluded_reason'] as const;
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = (data ?? []).map((r) => cols.map((c) => cell((r as Record<string, unknown>)[c])).join(','));
  return new Response([cols.join(','), ...rows].join('\n') + '\n', {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'private, no-store' },
  });
}
