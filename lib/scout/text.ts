// Page text for the scout (doc 04, section 6.3, step 2): what a reader sees, with tags, scripts and styles removed.
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#8358': '₦', '#x20a6': '₦' };

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h[1-6]|td|th)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(
      /&(#?\w+);/g,
      (m, e: string) =>
        ENTITIES[e.toLowerCase()] ?? (e.startsWith('#') ? String.fromCodePoint(Number(e.startsWith('#x') ? `0x${e.slice(2)}` : e.slice(1)) || 32) : m),
    )
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

// For matching a quote against the page: one space between words, one way of writing the naira sign, no commas.
export const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/[₦]|\bngn\b/g, 'n')
    .replace(/(\d),(?=\d{3})/g, '$1')
    .replace(/[“”"‘’']/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// robots.txt (doc 04, 6.2): the rules for our agent if it is named, else for "*". Longest matching rule wins.
export function robotsAllow(robots: string, path: string, agent = 'sowetinpricescout'): boolean {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
  let current: (typeof groups)[number] | null = null;
  for (const raw of robots.split('\n')) {
    const line = raw.replace(/#.*/, '').trim();
    const [key, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    const k = key.trim().toLowerCase();
    if (k === 'user-agent') {
      if (!current || current.rules.length) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
    } else if ((k === 'allow' || k === 'disallow') && current) current.rules.push({ allow: k === 'allow', path: value });
  }
  const group = groups.find((g) => g.agents.some((a) => a !== '*' && agent.startsWith(a))) ?? groups.find((g) => g.agents.includes('*'));
  const match = (group?.rules ?? []).filter((r) => r.path && path.startsWith(r.path)).sort((a, b) => b.path.length - a.path.length)[0];
  return match ? match.allow : true;
}
