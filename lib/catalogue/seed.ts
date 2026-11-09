// Seed checks and the SQL that loads the draft seeds. Pure: callers read the files and run the SQL.
import type { CatalogueSeed, IngredientsSeed } from './types';

const MEAL_TIMES = new Set(['breakfast', 'lunch', 'dinner', 'late_night']);
const UNITS = new Set(['g', 'ml', 'piece']);
const HOUSE_GROUPS = new Set([null, 'foodstuff', 'basic']);

// Plate key: "{template}:{slot}={slug}[+{slug}],{slot}={slug}" (doc 03, section 1).
export function parsePlateKey(key: string): { template: string; slots: { slot: string; slugs: string[] }[] } | null {
  const m = /^([a-z_]+):(.+)$/.exec(key);
  if (!m) return null;
  const slots = m[2].split(',').map((part) => {
    const [slot, slugs] = part.split('=');
    return { slot, slugs: (slugs ?? '').split('+').filter(Boolean) };
  });
  return slots.every((s) => s.slot && s.slugs.length) ? { template: m[1], slots } : null;
}

export function validateSeed(cat: CatalogueSeed, ing: IngredientsSeed): string[] {
  const errors: string[] = [];
  const ingredients = new Map(ing.ingredients.map((i) => [i.slug, i]));
  const components = new Map(cat.components.map((c) => [c.slug, c]));
  const types = new Set(cat.components.flatMap((c) => c.types));
  const tags = new Set(cat.tag_vocabulary);
  const allergens = new Set(cat.allergen_vocabulary);
  const templates = new Map(cat.plate_templates.map((t) => [t.key, t]));

  if (ingredients.size !== ing.ingredients.length) errors.push('duplicate ingredient slug');
  if (components.size !== cat.components.length) errors.push('duplicate component slug');

  for (const i of ing.ingredients) {
    if (!UNITS.has(i.canonical_unit)) errors.push(`${i.slug}: unknown unit ${i.canonical_unit}`);
    if (!HOUSE_GROUPS.has(i.house_group)) errors.push(`${i.slug}: unknown house group ${i.house_group}`);
    for (const a of [...i.allergens, ...i.may_contain]) if (!allergens.has(a)) errors.push(`${i.slug}: unknown allergen ${a}`);
    if (!i.market_units.some((u) => u.sellable && u.canonical_qty > 0)) errors.push(`${i.slug}: no sellable market unit`);
  }

  for (const c of cat.components) {
    for (const m of c.meal_times) if (!MEAL_TIMES.has(m)) errors.push(`${c.slug}: unknown meal time ${m}`);
    for (const t of c.tags) if (!tags.has(t)) errors.push(`${c.slug}: tag ${t} isn't in tag_vocabulary`);
    const seen = new Set<string>();
    for (const line of c.ingredient_lines) {
      if (!ingredients.has(line.ingredient)) errors.push(`${c.slug}: unknown ingredient ${line.ingredient}`);
      if (seen.has(line.ingredient)) errors.push(`${c.slug}: ingredient ${line.ingredient} listed twice`);
      seen.add(line.ingredient);
    }
    if (c.batch_servings_min < 1) errors.push(`${c.slug}: batch_servings_min below 1`);
  }

  const pairs = new Set<string>();
  for (const p of cat.pairings) {
    for (const s of [p.a, p.b]) if (!components.has(s)) errors.push(`pairing ${p.a}+${p.b}: unknown component ${s}`);
    if (p.score < 0 || p.score > 1) errors.push(`pairing ${p.a}+${p.b}: score out of 0..1`);
    const k = [p.a, p.b].sort().join('+');
    if (pairs.has(k)) errors.push(`pairing ${k} listed twice`);
    pairs.add(k);
  }
  for (const d of cat.pairing_defaults) for (const t of [d.a, d.b]) if (!types.has(t)) errors.push(`pairing default: unknown type ${t}`);

  for (const t of cat.plate_templates) {
    if (!t.slots.some((s) => s.key === t.main_slot)) errors.push(`${t.key}: main slot ${t.main_slot} missing`);
    for (const m of t.meal_times) if (!MEAL_TIMES.has(m)) errors.push(`${t.key}: unknown meal time ${m}`);
    for (const s of t.slots) for (const ty of s.types) if (!types.has(ty)) errors.push(`${t.key}.${s.key}: no component has type ${ty}`);
  }

  for (const key of cat.classic_plates) {
    const plate = parsePlateKey(key);
    const t = plate && templates.get(plate.template);
    if (!plate || !t) {
      errors.push(`classic plate ${key}: bad key or template`);
      continue;
    }
    for (const { slot, slugs } of plate.slots) {
      if (!t.slots.some((s) => s.key === slot)) errors.push(`classic plate ${key}: no slot ${slot}`);
      for (const s of slugs) if (!components.has(s)) errors.push(`classic plate ${key}: unknown component ${s}`);
    }
  }
  return errors;
}

const lit = (v: unknown): string => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'null';
  if (typeof v === 'boolean') return String(v);
  if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return v.length ? `array[${v.map(lit).join(',')}]::text[]` : `'{}'::text[]`;
  if (typeof v === 'object') return `${lit(JSON.stringify(v))}::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
};

function insert(table: string, cols: string[], rows: unknown[][]): string {
  if (!rows.length) return '';
  return `insert into ${table} (${cols.join(', ')}) values\n${rows.map((r) => `  (${r.map(lit).join(', ')})`).join(',\n')}\non conflict do nothing;\n`;
}

// After the first import the database and admin are the source of truth, so rows that exist are never overwritten.
export function seedSql(cat: CatalogueSeed, ing: IngredientsSeed, area = { id: 'lagos', name: 'Lagos', state: 'Lagos' }): string {
  return [
    '-- Generated by scripts/import-seed.ts from data/*.json. Every component is a draft (BR-40, BR-41).',
    insert('areas', ['id', 'name', 'state'], [[area.id, area.name, area.state]]),
    insert('snapshot_version', ['id', 'version'], [[1, 1]]),
    insert(
      'ingredients',
      ['id', 'name', 'local_names', 'category', 'canonical_unit', 'allergens', 'may_contain', 'is_animal', 'is_pork', 'house_group'],
      ing.ingredients.map((i) => [i.slug, i.name, i.local_names, i.category, i.canonical_unit, i.allergens, i.may_contain, i.animal, i.pork, i.house_group]),
    ),
    insert(
      'market_units',
      ['ingredient_id', 'area_id', 'label', 'canonical_qty', 'is_minimum', 'sellable', 'is_placeholder'],
      ing.ingredients.flatMap((i) => i.market_units.map((u) => [i.slug, area.id, u.label, u.canonical_qty, u.is_minimum, u.sellable, u.placeholder])),
    ),
    insert(
      'components',
      [
        'id',
        'name',
        'local_names',
        'aliases',
        'types',
        'cuisine_family',
        'region',
        'meal_times',
        'effort',
        'total_minutes',
        'spice_level',
        'vegetarian_ok',
        'tags',
        'protein_included',
        'needs_sauce',
        'forgotten_classic',
        'availability',
        'popularity_prior',
        'batch_servings_min',
        'house_chip',
        'equipment',
        'tips',
        'mistakes',
        'storage',
        'serving_note',
        'pcm',
        'pcm_reviewed',
        'status',
      ],
      cat.components.map((c) => [
        c.slug,
        c.name,
        c.local_names,
        c.aliases,
        c.types,
        c.cuisine_family,
        c.region,
        c.meal_times,
        c.effort,
        c.total_minutes,
        c.spice_level,
        c.vegetarian_ok,
        c.tags,
        c.protein_included,
        c.needs_sauce,
        c.forgotten_classic,
        c.availability,
        c.popularity_prior,
        c.batch_servings_min,
        c.house_chip,
        c.equipment,
        c.tips,
        c.mistakes,
        c.storage,
        c.serving_note,
        c.pcm,
        c.pcm_reviewed,
        'draft',
      ]),
    ),
    insert(
      'component_ingredients',
      ['component_id', 'ingredient_id', 'qty_per_serving', 'grp', 'optional', 'sort'],
      cat.components.flatMap((c) => c.ingredient_lines.map((l, n) => [c.slug, l.ingredient, l.qty_per_serving, l.group, l.optional, n])),
    ),
    insert(
      'plate_templates',
      ['key', 'name', 'meal_times', 'main_slot', 'slots'],
      cat.plate_templates.map((t) => [t.key, t.name, t.meal_times, t.main_slot, t.slots]),
    ),
    insert(
      'pairing_defaults',
      ['type_a', 'type_b', 'score'],
      cat.pairing_defaults.map((d) => [d.a, d.b, d.score]),
    ),
    insert(
      'pairings',
      ['component_a', 'component_b', 'score', 'note', 'status'],
      cat.pairings.map((p) => {
        const [a, b] = [p.a, p.b].sort();
        return [a, b, p.score, p.note, p.status];
      }),
    ),
    insert(
      'classic_plates',
      ['plate_key', 'sort'],
      cat.classic_plates.map((k, n) => [k, n]),
    ),
  ].join('\n');
}
