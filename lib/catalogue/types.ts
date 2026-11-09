// Shapes of data/catalogue-seed.json and data/ingredients-seed.json (draft seeds from the pack, doc 05).
export type MealTimeKey = 'breakfast' | 'lunch' | 'dinner' | 'late_night';

export type IngredientLineSeed = { ingredient: string; optional: boolean; qty_per_serving: number | null; group: string | null };

export type ComponentSeed = {
  slug: string;
  name: string;
  types: string[];
  cuisine_family: string;
  region: string;
  meal_times: MealTimeKey[];
  effort: number;
  total_minutes: number;
  spice_level: number;
  tags: string[];
  local_names: Record<string, string>;
  aliases: string[];
  popularity_prior: number;
  protein_included: boolean;
  needs_sauce: boolean;
  forgotten_classic: boolean;
  availability: string;
  ingredient_lines: IngredientLineSeed[];
  equipment: string[];
  tips: string[];
  mistakes: string[];
  storage: string | null;
  serving_note: string | null;
  pcm: Record<string, unknown>;
  pcm_reviewed: boolean;
  status: string;
  vegetarian_ok: boolean;
  batch_servings_min: number;
  house_chip: boolean;
};

export type SlotSeed = {
  key: string;
  types: string[];
  min: number;
  max: number;
  requires_pairing_with?: string;
  min_pairing?: number;
  second_requires_pairing?: boolean;
};
export type TemplateSeed = { key: string; name: string; meal_times: MealTimeKey[]; main_slot: string; slots: SlotSeed[] };

export type CatalogueSeed = {
  allergen_vocabulary: string[];
  tag_vocabulary: string[];
  plate_templates: TemplateSeed[];
  pairing_defaults: { a: string; b: string; score: number }[];
  pairings: { a: string; b: string; score: number; note: string | null; status: string }[];
  classic_plates: string[];
  components: ComponentSeed[];
};

export type MarketUnitSeed = { label: string; canonical_qty: number; is_minimum: boolean; sellable: boolean; placeholder: boolean };

export type IngredientSeed = {
  slug: string;
  name: string;
  category: string;
  canonical_unit: 'g' | 'ml' | 'piece';
  allergens: string[];
  may_contain: string[];
  animal: boolean;
  pork: boolean;
  local_names: Record<string, string>;
  market_units: MarketUnitSeed[];
  house_group: 'foodstuff' | 'basic' | null;
};

export type IngredientsSeed = { ingredients: IngredientSeed[] };
