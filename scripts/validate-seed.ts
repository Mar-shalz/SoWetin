// pnpm seed:validate: checks every reference in the seeds (CLAUDE.md commands, doc 15 CI).
import { readFileSync } from 'node:fs';
import { validateSeed } from '../lib/catalogue/seed.ts';

const read = (f: string) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const errors = validateSeed(read('catalogue-seed.json'), read('ingredients-seed.json'));
if (errors.length) {
  console.error(`${errors.length} seed problems:\n${errors.map((e) => `  ${e}`).join('\n')}`);
  process.exit(1);
}
console.log('Seeds OK: every reference resolves.');
