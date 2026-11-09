// Both message files must hold the same keys with the same {arguments} (CLAUDE.md rule 4, pnpm i18n:check).
type Messages = { [key: string]: string | Messages };

export function flatten(m: Messages, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(m)) {
    if (typeof v === 'string') out[prefix + k] = v;
    else Object.assign(out, flatten(v, `${prefix}${k}.`));
  }
  return out;
}

// Top-level ICU argument names only: "{count, plural, one {# person}...}" yields "count".
function args(s: string): string {
  const names: string[] = [];
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{') {
      if (depth === 0) names.push(/^\{\s*(\w+)/.exec(s.slice(i))?.[1] ?? '');
      depth++;
    } else if (s[i] === '}') depth--;
  }
  return [...new Set(names)].sort().join(',');
}

export function compareMessages(en: Messages, pcm: Messages): string[] {
  const a = flatten(en);
  const b = flatten(pcm);
  const problems: string[] = [];
  for (const k of Object.keys(a)) {
    if (!(k in b)) problems.push(`missing in pcm.json: ${k}`);
    else if (args(a[k]) !== args(b[k])) problems.push(`different arguments in ${k}: {${args(a[k])}} vs {${args(b[k])}}`);
  }
  for (const k of Object.keys(b)) if (!(k in a)) problems.push(`missing in en-NG.json: ${k}`);
  return problems;
}
