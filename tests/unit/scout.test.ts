import { describe, expect, it } from 'vitest';
import { toObservation } from '@/lib/admin/prices';
import { scoutPages } from '@/lib/scout/run';
import { htmlToText, robotsAllow } from '@/lib/scout/text';
import { pricesIn, processed, unitAgrees, unitQty, verify, type IngredientInfo } from '@/lib/scout/verify';

const rice: IngredientInfo = { canonicalUnit: 'g', units: [{ label: 'derica', qty: 780 }] };
const oil: IngredientInfo = { canonicalUnit: 'ml', units: [] };
const eggs: IngredientInfo = { canonicalUnit: 'piece', units: [] };

describe('price scout checks (doc 04, section 6.3)', () => {
  it('reads page text without scripts, styles or tags', () => {
    expect(htmlToText('<style>x{}</style><p>Rice:&nbsp;<b>&#8358;105,000</b></p><script>alert(1)</script>')).toBe('Rice: ₦105,000');
  });

  it('obeys robots.txt, our own rules first, the longest rule winning', () => {
    const robots = 'User-agent: *\nDisallow: /\n\nUser-agent: SoWetinPriceScout\nDisallow: /private\nAllow: /private/prices';
    expect(robotsAllow(robots, '/markets/lagos')).toBe(true);
    expect(robotsAllow(robots, '/private/x')).toBe(false);
    expect(robotsAllow(robots, '/private/prices/oct')).toBe(true);
    expect(robotsAllow('User-agent: *\nDisallow: /', '/anything')).toBe(false);
    expect(robotsAllow('', '/anything')).toBe(true);
  });

  it('finds prices the way reports write them, and units in the right measure', () => {
    expect(pricesIn('Rice: N105,000 per 50kg bag')).toContain(105000);
    expect(pricesIn('₦1.5k a derica')).toContain(1500);
    expect(pricesIn('now 2 million naira')).toContain(2_000_000);
    expect(unitQty('50kg bag', rice)).toBe(50000);
    expect(unitQty('Derica', rice)).toBe(780);
    expect(unitQty('5 litre', oil)).toBe(5000);
    expect(unitQty('75cl bottle', oil)).toBe(750);
    expect(unitQty('5 litre', rice)).toBeNull();
    expect(unitQty('crate', eggs)).toBe(30);
    expect(unitQty('bag', rice)).toBeNull();
  });

  it('reads shop packs and a bare kilogramme', () => {
    const chicken: IngredientInfo = { canonicalUnit: 'g', units: [] };
    expect(unitQty('8 g x50', eggs)).toBe(50);
    expect(unitQty('pack of 50', eggs)).toBe(50);
    expect(unitQty('100 cubes', eggs)).toBe(100);
    expect(unitQty('8 g x50', chicken)).toBe(8);
    expect(unitQty('kilogramme', chicken)).toBe(1000);
    expect(unitQty('per kg', chicken)).toBe(1000);
    expect(unitQty('2 kilogrammes', chicken)).toBe(2000);
    expect(unitQty('per kg', oil)).toBeNull();
    expect(unitQty('litre', oil)).toBe(1000);
  });

  it('lets the size written in the quote beat the unit the AI chose', () => {
    const carrot: IngredientInfo = { canonicalUnit: 'g', units: [{ label: 'heap', qty: 500 }] };
    const beans: IngredientInfo = { canonicalUnit: 'g', units: [{ label: 'cup', qty: 250 }, { label: 'paint bucket', qty: 3000 }] };
    expect(unitAgrees('heap', 'Carrot 5 kg ₦15,900', carrot)).toBe(false);
    expect(unitAgrees('cup', 'Beans - White (Paint Bucket) ₦8,700', beans)).toBe(false);
    expect(unitAgrees('paint bucket', 'Beans - White (Paint Bucket) ₦8,700', beans)).toBe(true);
    expect(unitAgrees('50kg bag', 'Local rice: N105,000 per 50kg bag', rice)).toBe(true);
    expect(unitAgrees('heap', 'Carrots now N1,500 a heap', carrot)).toBe(true);
    expect(unitAgrees('heap', 'Carrot (Fresh) ₦16,700', carrot)).toBe(false);
    expect(unitAgrees('cup', 'Beans - White ₦2,990', beans)).toBe(false);
    expect(unitAgrees('piece', 'Onions ₦420', eggs)).toBe(true);
    expect(unitAgrees('1 kg', '₦7,740.00', beans)).toBe(false);
    expect(unitAgrees('1 kg', 'Carrot 1 kg ₦3,500.00', carrot)).toBe(true);
    expect(processed('garlic', 'Tesco Garlic Powder 45 g ₦7,310.00')).toBe(true);
    expect(processed('carrot', 'Baby Carrots In Water ₦2,100')).toBe(true);
    expect(processed('garlic', 'Garlic - Imported ~1 kg ₦5,900.00')).toBe(false);
    expect(processed('curry-powder', 'Curry Powder 50 g ₦280')).toBe(false);
    expect(processed('seasoning-cube', 'Seasoning cubes x50 ₦1,000')).toBe(false);
    const page = 'Carrot 5 kg ₦15,900';
    const o = { ingredient: 'carrot', unit_text: 'heap', price_ngn: 15900, market: 'Lagos', area: 'Lagos', period: '2026-11-21', quote: page };
    expect(verify(o, page, carrot, '2026-11-21', 45)).toEqual({ ok: false, reason: 'unit differs from the quote' });
  });

  it('maps market words (paint, tuber, bag) to our own units instead of rejecting them', () => {
    const garri: IngredientInfo = { canonicalUnit: 'g', units: [{ label: 'cup', qty: 250 }, { label: 'paint bucket', qty: 3000 }, { label: '50 kg bag', qty: 50000 }] };
    const yam: IngredientInfo = { canonicalUnit: 'g', units: [{ label: 'small tuber', qty: 1200 }, { label: 'medium tuber', qty: 2000 }, { label: 'big tuber', qty: 3000 }] };
    expect(unitQty('paint', garri)).toBe(3000);
    expect(unitQty('per paint', garri)).toBe(3000);
    expect(unitQty('big bag', garri)).toBe(50000);
    expect(unitQty('tuber', yam)).toBe(2000);
    expect(unitQty('small tuber', yam)).toBe(1200);
    expect(unitQty('carton', garri)).toBeNull();
  });

  it('keeps an observation only when every part checks out against the page', () => {
    const page = 'Mile 12 market, Lagos. Local rice: N105,000 per 50kg bag (October 2026).';
    const o = {
      ingredient: 'rice-local-parboiled',
      unit_text: '50kg bag',
      price_ngn: 105000,
      market: 'Mile 12',
      area: 'Lagos',
      period: '2026-10',
      quote: 'Local rice: N105,000 per 50kg bag',
    };
    expect(verify(o, page, rice, '2026-11-09', 45)).toEqual({
      ok: true,
      row: {
        ingredient_id: 'rice-local-parboiled',
        unit_label: '50kg bag',
        unit_canonical_qty: 50000,
        price_ngn: 105000,
        observed_on: '2026-10-15',
        market: 'Mile 12',
        source_quote: 'Local rice: N105,000 per 50kg bag',
      },
    });
    expect(verify({ ...o, quote: 'Local rice: N95,000 per 50kg bag' }, page, rice, '2026-11-09', 45)).toEqual({ ok: false, reason: 'quote not on the page' });
    expect(verify({ ...o, price_ngn: 100000 }, page, rice, '2026-11-09', 45)).toEqual({ ok: false, reason: 'price not in the quote' });
    expect(verify(o, page, rice, '2027-01-30', 45)).toEqual({ ok: false, reason: 'too old' });
    expect(verify({ ...o, area: 'national' }, page, rice, '2026-11-09', 45)).toEqual({ ok: false, reason: 'not Lagos' });
    expect(verify({ ...o, unit_text: 'bag' }, page, rice, '2026-11-09', 45)).toEqual({ ok: false, reason: 'unit not convertible' });
  });

  it('weighs scout prices by their source and treats bulk units as wholesale', () => {
    const o = toObservation({
      price_ngn: 105000,
      unit_canonical_qty: 50000,
      unit_label: '50kg bag',
      observed_on: '2026-10-15',
      market: 'Mile 12',
      source: 'ai_scout',
      source_id: 'abc',
      confirmed_outlier: false,
      price_sources: { name: 'Market report, Example', kind: 'press_survey', weight: 0.7, bias_factor: 1.12 },
    });
    expect(o).toMatchObject({ kind: 'press_survey', sourceWeight: 0.7, biasFactor: 1.12, wholesale: true, sourceName: 'Market report, Example' });
    expect(
      toObservation({ price_ngn: 1, unit_canonical_qty: 1, observed_on: '2026-10-15', market: null, source: 'ai_scout', confirmed_outlier: false }),
    ).toBeNull();
  });
});

describe('a scout run with stand-in websites', () => {
  const page = '<h1>Lagos food prices</h1><table><tr><td>Local rice: N105,000 per 50kg bag at Mile 12, Lagos</td></tr></table>';
  const answer = {
    observations: [
      {
        ingredient: 'rice-local-parboiled',
        unit_text: '50kg bag',
        price_ngn: 105000,
        market: 'Mile 12',
        area: 'Lagos',
        period: '2026-10',
        quote: 'Local rice: N105,000 per 50kg bag',
      },
      {
        ingredient: 'rice-local-parboiled',
        unit_text: '50kg bag',
        price_ngn: 99000,
        market: 'Mile 12',
        area: 'Lagos',
        period: '2026-10',
        quote: 'Rice now N99,000',
      },
    ],
  };
  const seen: string[] = [];
  const fakeFetch = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    seen.push(url);
    if (url.endsWith('/robots.txt')) return new Response('User-agent: *\nDisallow: /members');
    if (url.includes('generativelanguage'))
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] }, finishReason: 'STOP' }] });
    if (url.includes('/moved')) return new Response(null, { status: 301, headers: { location: 'https://elsewhere.example.org/x' } });
    return new Response(page, { headers: { 'content-type': 'text/html' } });
  }) as typeof fetch;

  it('keeps verified prices, rejects the rest with reasons, and never leaves the allowed sources', async () => {
    const r = await scoutPages(
      ['https://news.example.com/prices', 'https://news.example.com/members/prices', 'https://unknown.example.net/p', 'https://news.example.com/moved'],
      [{ id: 'src-1', name: 'Market report, Example', domain: 'example.com' }],
      new Map([['rice-local-parboiled', { name: 'Local rice', info: rice }]]),
      { key: 'k', model: 'm', timeoutMs: 1000 },
      '2026-11-09',
      { delayMs: 0, timeoutMs: 1000, maxBytes: 100_000, userAgent: 'SoWetinPriceScout/1.0', maxAgeDays: 45, maxPages: 5 },
      fakeFetch,
    );
    expect(r.pagesRead).toBe(1);
    expect(r.kept).toEqual([
      expect.objectContaining({ ingredient_id: 'rice-local-parboiled', price_ngn: 105000, source_id: 'src-1', source_url: 'https://news.example.com/prices' }),
    ]);
    expect(r.rejected.map((x) => x.reason)).toEqual([
      'quote not on the page',
      'robots.txt says no',
      'not an active source with checked terms',
      'redirects off the source',
    ]);
    expect(seen.some((u) => u.includes('unknown.example.net') || u.includes('elsewhere.example.org'))).toBe(false);
  });
});
