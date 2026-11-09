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

export function personaFor(answers: Record<string, boolean>, cfg: Pick<AppConfig, 'PERSONA_EVERYTHING_MIN_YUMS' | 'PERSONA_CONNOISSEUR_MAX_YUMS'>): Persona {
  const yums = Object.keys(GAME_CARDS).filter((card) => answers[card]);
  if (yums.length >= cfg.PERSONA_EVERYTHING_MIN_YUMS) return 'everything';
  if (yums.length <= cfg.PERSONA_CONNOISSEUR_MAX_YUMS) return 'connoisseur';
  const points: Partial<Record<Persona, number>> = {};
  for (const card of yums) for (const [p, n] of Object.entries(GAME_CARDS[card])) points[p as Persona] = (points[p as Persona] ?? 0) + n;
  // Ties go to the fixed order of PERSONAS, never to the order the cards were answered.
  return PERSONAS.reduce((best, p) => ((points[p] ?? 0) > (points[best] ?? 0) ? p : best), PERSONAS[0]);
}
