// Chop Personality (F29, doc 03 section 6.4). The same answers always give the same personality (BR-151).
import type { AppConfig } from '../config/app.config';

export const PERSONAS = ['swallow', 'pepper', 'jollof', 'street', 'explorer', 'comfort', 'breakfast', 'quick', 'everything', 'connoisseur'] as const;
export type Persona = (typeof PERSONAS)[number];

// Points each game card gives on Yum. Card ids are catalogue slugs.
export const GAME_CARDS: Record<string, Partial<Record<Persona, number>>> = {
  'egusi-soup': { swallow: 2, explorer: 1, comfort: 1 },
  'jollof-rice': { jollof: 3 },
  suya: { pepper: 2, street: 2 },
  amala: { swallow: 3 },
  'banga-soup': { explorer: 3 },
  akara: { breakfast: 3, street: 1 },
  'goat-pepper-soup': { pepper: 3 },
  dodo: { jollof: 1, comfort: 1 },
  'ewa-agoyin': { comfort: 2, street: 1, breakfast: 1 },
  'afang-soup': { explorer: 2, swallow: 1 },
  'instant-noodles': { quick: 3 },
  ukwa: { comfort: 2, explorer: 1 },
};

export type Points = Partial<Record<Persona, number>>;
export type GameDish = { id: string; types: string[]; tags: string[]; region: string; spice: number; minutes: number; mealTimes: string[] };

// Points for any catalogue dish, so a game can deal any 12 (Victor, 10 November 2026). Hand-set weights win.
export function personaPoints(d: GameDish): Points {
  if (GAME_CARDS[d.id]) return GAME_CARDS[d.id];
  const p: Points = {};
  const add = (k: Persona, n: number) => (p[k] = (p[k] ?? 0) + n);
  if (d.types.includes('swallow') || d.types.includes('soup')) add('swallow', 2);
  if (d.spice >= 3 || d.tags.includes('peppery')) add('pepper', 2);
  if (d.types.includes('rice') || d.tags.includes('base_rice') || d.tags.includes('party_food')) add('jollof', 2);
  if (d.tags.includes('street_food') || d.types.includes('snack')) add('street', 2);
  if (!['pan_nigerian', 'yoruba'].includes(d.region)) add('explorer', 2); // beyond the Lagos everyday
  if (d.tags.includes('comfort') || d.tags.includes('base_beans') || d.tags.includes('base_yam')) add('comfort', 1);
  if (d.mealTimes.includes('breakfast') || d.tags.includes('breakfast_friendly')) add('breakfast', 2);
  if (d.minutes <= 20 || d.tags.includes('quick')) add('quick', 2);
  return p;
}

// A balanced deck: dishes grouped by the personality they lean to, dealt round-robin so every group shows up.
export function dealDeck(pool: GameDish[], size: number, random: () => number): string[] {
  const lean = (d: GameDish) => Object.entries(personaPoints(d)).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0] ?? 'everything';
  const groups = new Map<string, string[]>();
  for (const d of pool) groups.set(lean(d), [...(groups.get(lean(d)) ?? []), d.id]);
  const shuffled = [...groups.values()].map((ids) => shuffleIds(ids, random));
  const deck: string[] = [];
  for (let round = 0; deck.length < size && shuffled.some((g) => g.length > round); round++)
    for (const g of shuffleIds(shuffled.map((_, i) => String(i)), random).map((i) => shuffled[Number(i)])) if (g[round] && deck.length < size) deck.push(g[round]);
  return shuffleIds(deck, random);
}
function shuffleIds(list: string[], random: () => number): string[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function personaFor(
  answers: Record<string, boolean>,
  cfg: Pick<AppConfig, 'PERSONA_EVERYTHING_MIN_YUMS' | 'PERSONA_CONNOISSEUR_MAX_YUMS'>,
  cards: Record<string, Points> = GAME_CARDS,
): Persona {
  const yums = Object.keys(cards).filter((card) => answers[card]);
  if (yums.length >= cfg.PERSONA_EVERYTHING_MIN_YUMS) return 'everything';
  if (yums.length <= cfg.PERSONA_CONNOISSEUR_MAX_YUMS) return 'connoisseur';
  const points: Partial<Record<Persona, number>> = {};
  for (const card of yums) for (const [p, n] of Object.entries(cards[card])) points[p as Persona] = (points[p as Persona] ?? 0) + (n ?? 0);
  // Ties go to the fixed order of PERSONAS, never to the order the cards were answered.
  return PERSONAS.reduce((best, p) => ((points[p] ?? 0) > (points[best] ?? 0) ? p : best), PERSONAS[0]);
}
