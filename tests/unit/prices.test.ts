import { describe, expect, it } from 'vitest';
import { checkImport, parseCsv, pricePointRow, type Known } from '@/lib/admin/prices';
import { APP_CONFIG as C } from '@/lib/config/app.config';

const known: Known = {
  areas: new Set(['lagos']),
  ingredients: new Map([
    ['tomato-fresh', 'Fresh tomatoes'],
    ['rice-local-parboiled', 'Local rice'],
  ]),
  units: new Map([
    ['tomato-fresh|lagos|heap', 900],
    ['rice-local-parboiled|lagos|derica', 780],
    ['rice-local-parboiled|lagos|50 kg bag', 50000],
  ]),
  mids: new Map([['tomato-fresh|lagos', 1]]),
};
const header = 'observed_on,area_slug,market,ingredient_slug,unit_label,unit_canonical_qty,price_ngn,source,notes\n';

describe('market check CSV (doc 04, section 7)', () => {
  it('reads quoted fields with commas, quotes and Windows line ends', () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\nd,e,f\n\n')).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['d', 'e', 'f'],
    ]);
  });

  it('accepts good rows, takes a weighing, and flags a big move without rejecting it', () => {
    const r = checkImport(
      header +
        '2026-11-20,lagos,Mile 12,tomato-fresh,heap,900,1000,retail_survey,"big heap, 6 pieces"\n' +
        '2026-11-20,lagos,Mile 12,rice-local-parboiled,derica,,"1,800",retail_survey,\n',
      known,
      '2026-11-20',
      C,
    );
    expect(r.problems).toEqual([]);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ weighed: true, unit_canonical_qty: 900, price_ngn: 1000, notes: 'big heap, 6 pieces', changePct: 11 });
    expect(r.rows[1]).toMatchObject({ weighed: false, unit_canonical_qty: 780, price_ngn: 1800, notes: null, changePct: null });
    const big = checkImport(header + '2026-11-20,lagos,Mile 12,tomato-fresh,heap,,1800,retail_survey,\n', known, '2026-11-20', C);
    expect(big.flagged.map((f) => f.changePct)).toEqual([100]);
  });

  it('rejects unknown ingredients and units with a suggestion, and future dates', () => {
    const r = checkImport(
      '2026-11-20,lagos,,tomato-freshh,heap,,1000,retail_survey,\n' +
        '2026-11-20,lagos,,rice-local-parboiled,cup,,1000,retail_survey,\n' +
        '2026-12-01,lagos,,tomato-fresh,heap,,1000,retail_survey,\n' +
        '2026-11-20,lagos,,tomato-fresh,heap,,12.5,retail_survey,\n' +
        '2026-11-20,lagos,,tomato-fresh,heap,,1000,ai_scout,\n',
      known,
      '2026-11-20',
      C,
    );
    expect(r.rows).toEqual([]);
    expect(r.problems).toEqual([
      { line: 1, reason: 'ingredient', hint: 'tomato-fresh' },
      { line: 2, reason: 'unit', hint: 'derica, 50 kg bag' },
      { line: 3, reason: 'date', hint: undefined },
      { line: 4, reason: 'price', hint: undefined },
      { line: 5, reason: 'source', hint: undefined },
    ]);
  });

  it('turns observations from two markets into a price point with its receipt', () => {
    const rows = [
      { price_ngn: 1000, unit_canonical_qty: 900, observed_on: '2026-11-20', market: 'Mile 12', source: 'retail_survey', confirmed_outlier: false },
      { price_ngn: 1200, unit_canonical_qty: 900, observed_on: '2026-11-20', market: 'Oyingbo', source: 'retail_survey', confirmed_outlier: false },
      { price_ngn: 999, unit_canonical_qty: 900, observed_on: '2026-11-20', market: 'web', source: 'ai_scout', confirmed_outlier: false },
    ];
    const p = pricePointRow('tomato-fresh', 'lagos', rows, null, '2026-11-21', C)!;
    expect(p).toMatchObject({ ingredient_id: 'tomato-fresh', area_id: 'lagos', sample_count: 2, source_count: 2, last_market_check: '2026-11-20' });
    expect(p.per_unit_low).toBeLessThanOrEqual(p.per_unit_mid);
    expect(p.sources_shown.map((s) => s.name)).toEqual(expect.arrayContaining(['Our market check, Mile 12', 'Our market check, Oyingbo']));
    expect(pricePointRow('tomato-fresh', 'lagos', rows, null, '2027-03-01', C)).toBeNull();
  });
});
