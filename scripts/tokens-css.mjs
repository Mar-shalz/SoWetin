// Generates app/tokens.css from design/tokens.json, so components never hard-code a token value (A-11).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('..', import.meta.url);
const tokens = JSON.parse(readFileSync(new URL('design/tokens.json', ROOT), 'utf8'));

const px = (n) => (typeof n === 'number' ? `${n}px` : n);
const val = (x) => (x && typeof x === 'object' && '$value' in x ? x.$value : x);
// next/font gives each self-hosted face a hashed family name, exposed through these variables (app/(app)/layout.tsx).
const NEXT_FONT = { 'Bricolage Grotesque': 'var(--nf-display)', 'Plus Jakarta Sans': 'var(--nf-body)' };
const fontStack = (stack) => stack.replace(/'([^']+)'/, (quoted, family) => NEXT_FONT[family] ?? quoted);
const block = (selector, lines) => `${selector} {\n${lines.map((l) => `  ${l}`).join('\n')}\n}`;

export function tokensCss(t = tokens) {
  // Reset Tailwind's own palette, radii, shadows and breakpoints so only token values exist.
  const theme = ['--color-*: initial;', '--radius-*: initial;', '--shadow-*: initial;', '--breakpoint-*: initial;'];
  for (const [k, v] of Object.entries(t.color)) theme.push(`--color-${k}: ${val(v)};`);
  for (const [k, v] of Object.entries(t.radius)) theme.push(`--radius-${k}: ${px(v)};`);
  for (const [k, v] of Object.entries(t.shadow)) if (v.$value) theme.push(`--shadow-${k}: ${v.$value};`);
  for (const [k, v] of Object.entries(t.breakpoint)) theme.push(`--breakpoint-${k}: ${px(v)};`);
  for (const [k, v] of Object.entries(t.motion.easing)) theme.push(`--ease-${k}: ${v};`);
  theme.push(`--container-app: ${px(t.size['app-column-max'])};`);

  const fonts = Object.entries(t.font).map(([k, v]) => `--font-${k}: ${fontStack(val(v))};`);

  const root = [];
  for (const [k, v] of Object.entries(t.motion.duration)) root.push(`--sw-duration-${k}: ${v}ms;`);
  for (const [k, v] of Object.entries(t.size)) root.push(`--sw-size-${k}: ${px(v)};`);
  for (const [k, v] of Object.entries(t.z)) root.push(`--sw-z-${k}: ${v};`);
  for (const [k, v] of Object.entries(t.border)) root.push(`--sw-border-${k}: ${val(v)};`);

  const utilities = Object.entries(t.type).map(([k, s]) =>
    block(`@utility type-${k}`, [
      `font-family: var(--font-${s.family});`,
      `font-size: ${px(s.size)};`,
      `line-height: ${px(s.line)};`,
      `font-weight: ${s.weight};`,
      `letter-spacing: ${px(s.tracking ?? 0)};`,
      ...(s.family === 'numeric' ? ['font-variant-numeric: tabular-nums;'] : []),
    ]),
  );

  return (
    [
      "/* Generated from design/tokens.json by scripts/tokens-css.mjs. Don't edit: change the tokens and run pnpm tokens. */",
      "/* Spacing: the token space scale (2, 4, 8 ... 64 px) sits on Tailwind's 4 px scale, so p-0.5 = 2 px, p-4 = 16 px. */",
      block('@theme', theme),
      block('@theme inline', fonts),
      block(':root', root),
      ...utilities,
    ].join('\n\n') + '\n'
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(new URL('app/tokens.css', ROOT), tokensCss());
  console.log('wrote app/tokens.css');
}
