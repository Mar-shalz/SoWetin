// pnpm seed:import: writes supabase/seed.sql from data/*.json. `supabase db reset` loads it locally;
// for staging, run it once in the Supabase SQL editor or with: psql "$DATABASE_URL" -f supabase/seed.sql
import { readFileSync, writeFileSync } from 'node:fs';
import { seedSql, validateSeed } from '../lib/catalogue/seed.ts';

const read = (f: string) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const cat = read('catalogue-seed.json');
const ing = read('ingredients-seed.json');
const errors = validateSeed(cat, ing);
if (errors.length) {
  console.error(`Fix the seeds first (pnpm seed:validate): ${errors.length} problems.`);
  process.exit(1);
}
writeFileSync(new URL('../supabase/seed.sql', import.meta.url), seedSql(cat, ing));
console.log('Wrote supabase/seed.sql.');
