// Price engine types (doc 04). Pure data: no IO, no clock. Dates are ISO "YYYY-MM-DD" strings.
export type Confidence = 'high' | 'medium' | 'low';
export type Freshness = 'fresh' | 'ageing' | 'stale';
export type SourceKind = 'market_check' | 'press_survey' | 'official_stats' | 'online_store';
export type LineGroup = 'base' | 'protein' | 'vegetable' | 'seasoning' | 'oil' | 'garnish';

export type Observation = {
  priceNgn: number;
  unitQty: number; // the observed unit in the ingredient's canonical unit (g, ml or piece)
  observedOn: string;
  kind: SourceKind;
  sourceId: string;
  sourceName: string;
  sourceWeight: number; // market check 1.0; scout sources carry price_sources.weight (doc 04, section 3, step 6)
  wholesale?: boolean; // bulk units (50 kg bag, 25 L keg, basket) get the retail factor
  biasFactor?: number; // scout sources only (section 6.6)
  confirmedOutlier?: boolean;
  area?: string;
};

export type PricePoint = {
  low: number; // naira per canonical unit
  mid: number;
  high: number;
  confidence: Confidence;
  asOf: string; // newest observation used
  oldest: string;
  sampleCount: number;
  sources: string[]; // every distinct source id used, for plate-level counts
  sourceKinds: Partial<Record<SourceKind, number>>;
  sourcesShown: { name: string; kind: SourceKind; observedOn: string; area?: string }[];
  lastMarketCheck: string | null;
  srcSpread: number;
  isEstimate: boolean; // unsurveyed area, priced from Lagos (BR-23)
};

export type MarketUnit = { label: string; qty: number; sellable: boolean; isMinimum?: boolean; observedPriceNgn?: number };
export type PricedIngredient = { id: string; canonicalUnit: 'g' | 'ml' | 'piece'; units: MarketUnit[] };
export type CostLineInput = { ingredientId: string; qtyPerServing: number | null; group: LineGroup | null };
export type CostComponent = { id: string; batchServingsMin: number; lines: CostLineInput[] };
export type House = { cooked: string[]; foodstuff: string[]; basic: string[] };
export type PriceBook = { points: Record<string, PricePoint>; ingredients: Record<string, PricedIngredient> };

export type Purchase = { label: string; count: number; qty: number };

export type CostLine = {
  ingredientId: string;
  need: number;
  bought: Purchase[];
  outlayMid: number;
  outlayLow: number;
  outlayHigh: number;
  useCost: number;
  spread: number;
  confidence: Confidence;
  asOf: string;
  leftoverQty: number; // shown only when it's LEFTOVER_SHOW_PCT or more of what was bought
  leftoverPlates: number;
};

export type PlateCost = {
  outlayLowNgn: number; // rounded down to PRICE_ROUNDING_NGN
  outlayHighNgn: number; // rounded up
  outlayMidNgn: number; // unrounded, for scoring
  useCostNgn: number;
  houseUseNgn: number; // value of house foodstuff the plate uses (not charged)
  plateUseNgn: number; // "about ₦X", rounded to PRICE_ROUNDING_NGN
  perPlateNgn: number;
  pot: { componentId: string; servings: number; moreMeals: number } | null;
  showUseLine: boolean;
  confidence: Confidence;
  freshness: Freshness;
  oldestPriceDate: string;
  sourceCount: number;
  isEstimate: boolean;
  pantryUsed: string[];
  leftovers: { ingredientId: string; qty: number; plates: number }[];
  lines: CostLine[];
};
