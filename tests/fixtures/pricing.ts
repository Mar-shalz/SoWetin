// Fixed fixtures for the doc 04, section 4.6 cases. Quantities and prices are made up and only need to be plausible.
import type { CostComponent, House, MarketUnit, PriceBook, PricedIngredient, PricePoint } from '@/lib/pricing/types';

export const TODAY = '2026-11-20';

export const point = (mid: number, over: Partial<PricePoint> = {}): PricePoint => ({
  low: mid * 0.97,
  mid,
  high: mid * 1.03,
  confidence: 'high',
  asOf: '2026-11-17',
  oldest: '2026-11-02',
  sampleCount: 4,
  sources: ['market-check-mile12', 'nairametrics'],
  sourceKinds: { market_check: 2, press_survey: 2 },
  sourcesShown: [],
  lastMarketCheck: '2026-11-17',
  srcSpread: 0.03,
  isEstimate: false,
  ...over,
});

const ing = (id: string, canonicalUnit: PricedIngredient['canonicalUnit'], units: MarketUnit[]): PricedIngredient => ({ id, canonicalUnit, units });

export const INGREDIENTS: Record<string, PricedIngredient> = {
  rice: ing('rice', 'g', [
    { label: 'derica', qty: 750, sellable: true, isMinimum: true },
    { label: 'paint bucket', qty: 4000, sellable: true },
    { label: '50 kg bag', qty: 50000, sellable: false },
  ]),
  'pepper-mix': ing('pepper-mix', 'g', [
    { label: '₦500 mix', qty: 300, sellable: true, isMinimum: true, observedPriceNgn: 500 },
    { label: '₦1,000 mix', qty: 650, sellable: true, observedPriceNgn: 1000 },
    { label: 'basket', qty: 25000, sellable: false },
  ]),
  chicken: ing('chicken', 'g', [
    { label: 'portion', qty: 250, sellable: true, isMinimum: true },
    { label: 'kg', qty: 1000, sellable: true },
  ]),
  plantain: ing('plantain', 'piece', [{ label: 'finger', qty: 1, sellable: true, isMinimum: true }]),
  'veg-oil': ing('veg-oil', 'ml', [
    { label: 'bottle', qty: 350, sellable: true, isMinimum: true },
    { label: '1 L', qty: 1000, sellable: true },
    { label: '25 L keg', qty: 25000, sellable: false },
  ]),
  onion: ing('onion', 'piece', [{ label: 'bulb', qty: 1, sellable: true, isMinimum: true }]),
  seasoning: ing('seasoning', 'piece', [
    { label: 'cube', qty: 1, sellable: true, isMinimum: true },
    { label: 'pack', qty: 50, sellable: true },
  ]),
  egusi: ing('egusi', 'g', [
    { label: 'cup', qty: 200, sellable: true, isMinimum: true },
    { label: 'derica', qty: 600, sellable: true },
  ]),
  'palm-oil': ing('palm-oil', 'ml', [{ label: 'bottle', qty: 350, sellable: true, isMinimum: true }]),
  crayfish: ing('crayfish', 'g', [{ label: '₦500 wrap', qty: 40, sellable: true, isMinimum: true, observedPriceNgn: 500 }]),
  garri: ing('garri', 'g', [{ label: 'cup', qty: 250, sellable: true, isMinimum: true }]),
};

export const POINTS: Record<string, PricePoint> = {
  rice: point(2.4),
  'pepper-mix': point(1.6),
  chicken: point(6),
  plantain: point(500),
  'veg-oil': point(3),
  onion: point(200),
  seasoning: point(25),
  egusi: point(6),
  'palm-oil': point(4),
  crayfish: point(12),
  garri: point(1.2),
};

export const book = (points: Record<string, PricePoint> = POINTS): PriceBook => ({ points, ingredients: INGREDIENTS });

export const C: Record<string, CostComponent> = {
  jollof: {
    id: 'jollof-rice',
    batchServingsMin: 1,
    lines: [
      { ingredientId: 'rice', qtyPerServing: 187.5, group: 'base' },
      { ingredientId: 'pepper-mix', qtyPerServing: 60, group: 'vegetable' },
      { ingredientId: 'veg-oil', qtyPerServing: 30, group: 'oil' },
      { ingredientId: 'onion', qtyPerServing: 0.25, group: 'vegetable' },
      { ingredientId: 'seasoning', qtyPerServing: 1, group: 'seasoning' },
      { ingredientId: 'salt', qtyPerServing: 2, group: 'seasoning' },
    ],
  },
  chicken: {
    id: 'fried-chicken',
    batchServingsMin: 1,
    lines: [
      { ingredientId: 'chicken', qtyPerServing: 200, group: 'protein' },
      { ingredientId: 'seasoning', qtyPerServing: 0.5, group: 'seasoning' },
    ],
  },
  dodo: {
    id: 'dodo',
    batchServingsMin: 1,
    lines: [
      { ingredientId: 'plantain', qtyPerServing: 1, group: 'base' },
      { ingredientId: 'veg-oil', qtyPerServing: 20, group: 'oil' },
    ],
  },
  egusi: {
    id: 'egusi-soup',
    batchServingsMin: 4,
    lines: [
      { ingredientId: 'egusi', qtyPerServing: 50, group: 'base' },
      { ingredientId: 'palm-oil', qtyPerServing: 25, group: 'oil' },
      { ingredientId: 'crayfish', qtyPerServing: 5, group: 'seasoning' },
      { ingredientId: 'pepper-mix', qtyPerServing: 30, group: 'vegetable' },
      { ingredientId: 'seasoning', qtyPerServing: 1, group: 'seasoning' },
    ],
  },
  eba: { id: 'eba', batchServingsMin: 1, lines: [{ ingredientId: 'garri', qtyPerServing: 120, group: 'base' }] },
  whiteRice: { id: 'white-rice', batchServingsMin: 1, lines: [{ ingredientId: 'rice', qtyPerServing: 150, group: 'base' }] },
  stew: {
    id: 'tomato-stew',
    batchServingsMin: 6,
    lines: [
      { ingredientId: 'pepper-mix', qtyPerServing: 80, group: 'vegetable' },
      { ingredientId: 'veg-oil', qtyPerServing: 30, group: 'oil' },
      { ingredientId: 'onion', qtyPerServing: 0.5, group: 'vegetable' },
      { ingredientId: 'seasoning', qtyPerServing: 1, group: 'seasoning' },
    ],
  },
};

export const EMPTY_HOUSE: House = { cooked: [], foodstuff: [], basic: [] };
