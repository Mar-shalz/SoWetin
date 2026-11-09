import { requireStaff } from '@/lib/admin/guard';
import { CSV_HEADER } from '@/lib/admin/prices';
import { APP_CONFIG as C } from '@/lib/config/app.config';

// "Export survey sheet" (doc 04, section 7): every Lagos market unit as a row for the price runner to fill in.
// shortcut: alphabetical; doc 04 wants "Neither" and move-alert items first once the scout runs.
export async function GET() {
  const { supabase } = await requireStaff();
  const { data } = await supabase
    .from('market_units')
    .select('ingredient_id, label, ingredients(name)')
    .eq('area_id', C.DEFAULT_AREA)
    .eq('sellable', true)
    .order('ingredient_id');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: C.TIMEZONE }).format(new Date());
  const cell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const rows = (data ?? []).map((u) => {
    const name = (u.ingredients as unknown as { name: string } | null)?.name ?? '';
    return [today, C.DEFAULT_AREA, '', u.ingredient_id, u.label, '', '', 'retail_survey', name].map(cell).join(',');
  });
  return new Response([CSV_HEADER.join(','), ...rows].join('\n') + '\n', {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="sowetin-market-check-${today}.csv"`,
      'cache-control': 'private, no-store',
    },
  });
}
