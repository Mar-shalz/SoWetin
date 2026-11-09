// Suggestion engine types (doc 03). The engine is pure: the snapshot, the context and the costing are all passed in.
import type { LineGroup, PlateCost } from '../pricing/types';
import type { MealTime } from './time';

export type EngineLine = { ingredientId: string; optional: boolean; qtyPerServing: number | null; group: LineGroup | null };

export type EngineComponent = {
  id: string;
  name: string;
  types: string[];
  region: string;
  cuisine: string;
  mealTimes: MealTime[];
  totalMinutes: number;
  spice: number;
  effort: number;
  tags: string[];
  popularity: number;
  proteinIncluded: boolean;
  needsSauce: boolean;
  vegetarianOk: boolean;
  batchServingsMin: number;
  lines: EngineLine[];
};

export type EngineIngredient = { id: string; allergens: string[]; mayContain: string[]; animal: boolean };
export type Slot = { key: string; types: string[]; min: number; max: number; requiresPairingWith?: string; minPairing?: number };
export type Template = { key: string; mealTimes: MealTime[]; mainSlot: string; slots: Slot[] };

export type Snapshot = {
  components: Map<string, EngineComponent>;
  ingredients: Map<string, EngineIngredient>;
  templates: Template[];
  pairings: Map<string, number>; // explicit, "a|b" with a < b
  pairingDefaults: Map<string, number>; // by slot type, "typeA|typeB" with typeA < typeB
};

// A filled template. Slots map to component ids; `without` lists optional ingredients dropped for the avoid list.
export type Plate = { template: string; slots: Record<string, string[]>; without: string[]; usesCooked: boolean };

export type Context = {
  now: string; // ISO date and time; the engine never reads the clock
  mealTime: MealTime;
  weekend: boolean;
  budget: number;
  people: number;
  filters: { plateTypes?: string[]; regions?: string[]; maxMinutes?: number; spiceMax?: number; vegetarian?: boolean };
  avoid: { ingredients: string[]; allergens: string[] };
  allergy: { ingredients: string[]; allergens: string[]; seasoningCubesOk: boolean };
  house: { cooked: string[]; foodstuff: string[]; basic: string[] };
  excludeMains: string[]; // everything already shown this session, and the cards on screen
  // A parsed craving (doc 03, 7.1): plate types it names (only those), dishes it names (plates must hold one) or rules out.
  craving?: { boostTags: string[]; avoidTags: string[]; plateTypes: string[]; include?: string[]; exclude?: string[] };
  signals: {
    affinities: Record<string, number>;
    count: number;
    ateAt: Record<string, string>;
    dislikedUntil: Record<string, string>;
    lastPositiveAt: Record<string, string>;
    seenMains: string[];
  };
  seed: string; // hash(user_id + request_id): the same request gives the same deck (doc 03, section 5)
};

export type CostFn = (plate: Plate) => PlateCost | null;

export type ScoredPlate = {
  plate: Plate;
  key: string;
  main: string;
  cost: PlateCost;
  score: number;
  stretch: boolean; // over budget but within STRETCH_PCT (BR-15)
  gapNgn: number; // how far over budget, for the tight state (BR-16)
  forgotten: boolean;
  newToUser: boolean;
};

export type Deck = { plates: ScoredPlate[]; tight: boolean; explored: boolean };
