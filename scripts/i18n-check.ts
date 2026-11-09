// pnpm i18n:check: fails if a key or an {argument} is missing from en-NG.json or pcm.json.
import { readFileSync } from 'node:fs';
import { compareMessages } from '../lib/i18n/check.ts';

const read = (f: string) => JSON.parse(readFileSync(new URL(`../messages/${f}`, import.meta.url), 'utf8'));
const problems = compareMessages(read('en-NG.json'), read('pcm.json'));
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('Messages OK: both languages have every key.');
