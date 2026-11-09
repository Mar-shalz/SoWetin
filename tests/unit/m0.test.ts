import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { tokensCss } from '@/scripts/tokens-css.mjs';
import { APP_CONFIG } from '@/lib/config/app.config';
import { resolveConfig } from '@/lib/config/resolve';
import { mealTimeAt } from '@/lib/engine/time';
import { compareMessages } from '@/lib/i18n/check';
import { formatNaira } from '@/lib/i18n/money';
import en from '@/messages/en-NG.json';
import pcm from '@/messages/pcm.json';

const root = (f: string) => new URL(`../../${f}`, import.meta.url);

describe('tokens', () => {
  it('app/tokens.css matches design/tokens.json (run pnpm tokens after changing tokens)', () => {
    expect(readFileSync(root('app/tokens.css'), 'utf8')).toBe(tokensCss());
  });
  it('every space token sits on the Tailwind scale', () => {
    const space = JSON.parse(readFileSync(root('design/tokens.json'), 'utf8')).space as Record<string, number>;
    for (const v of Object.values(space)) expect(v % 2).toBe(0);
  });
});

describe('fonts (doc 12 budgets)', () => {
  it('display subset is 35 KB or less, body subset 30 KB or less', () => {
    expect(statSync(root('app/fonts/bricolage-grotesque.woff2')).size).toBeLessThanOrEqual(35 * 1024);
    expect(statSync(root('app/fonts/plus-jakarta-sans.woff2')).size).toBeLessThanOrEqual(30 * 1024);
  });
});

describe('config', () => {
  // docs/ stays on Victor's machine and isn't in the repo, so CI skips this check.
  it.skipIf(!existsSync(root('docs/01-product-requirements.md')))('holds every key in PRD section 12', () => {
    const prd = readFileSync(root('docs/01-product-requirements.md'), 'utf8');
    const table = prd.slice(prd.indexOf('## 12. Configuration values'));
    const keys = [...table.matchAll(/^\| ((?:`[A-Z0-9_]+`(?:, )?)+) \|/gm)].flatMap((m) => [...m[1].matchAll(/`([A-Z0-9_]+)`/g)].map((k) => k[1]));
    expect(keys.length).toBeGreaterThan(60);
    expect(keys.filter((k) => !(k in APP_CONFIG))).toEqual([]);
  });
  it('applies good overrides and rejects bad ones without throwing', () => {
    const { config, rejected } = resolveConfig([
      { key: 'DECK_SIZE', value: 4 },
      { key: 'PRICE_SPREAD', value: { high: 0.1, medium: 0.2, low: 0.3 } },
      { key: 'BUDGET_CHIPS', value: [1500, 3000] },
      { key: 'STRETCH_PCT', value: '20' },
      { key: 'PRICE_SPREAD_MAX', value: null },
      { key: 'MEAL_WINDOWS', value: { breakfast: '06:00' } },
      { key: 'NOT_A_KEY', value: 1 },
    ]);
    expect(config.DECK_SIZE).toBe(4);
    expect(config.PRICE_SPREAD.low).toBe(0.3);
    expect(config.BUDGET_CHIPS).toEqual([1500, 3000]);
    expect(config.STRETCH_PCT).toBe(15);
    expect(rejected).toEqual(['STRETCH_PCT', 'PRICE_SPREAD_MAX', 'MEAL_WINDOWS', 'NOT_A_KEY']);
  });
});

describe('meal time (BR-01, BR-02)', () => {
  const at = (lagosHHMM: string) => mealTimeAt(new Date(`2026-11-09T${lagosHHMM}:00+01:00`), APP_CONFIG.MEAL_WINDOWS, APP_CONFIG.TIMEZONE);
  it.each([
    ['00:30', 'late_night'],
    ['04:59', 'late_night'],
    ['05:00', 'breakfast'],
    ['10:59', 'breakfast'],
    ['11:00', 'lunch'],
    ['15:59', 'lunch'],
    ['16:00', 'dinner'],
    ['21:59', 'dinner'],
    ['22:00', 'late_night'],
    ['23:59', 'late_night'],
  ])('%s Lagos is %s', (hhmm, meal) => expect(at(hhmm)).toBe(meal));
});

describe('copy', () => {
  it('both languages have the same keys and arguments', () => expect(compareMessages(en, pcm)).toEqual([]));
  it('formats naira as ₦2,500', () => {
    expect(formatNaira(2500)).toBe('₦2,500');
    expect(formatNaira(500000)).toBe('₦500,000');
  });
});
