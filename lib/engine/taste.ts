// Taste learning (doc 03, section 6). Pure: callers pass the days since each tag was last updated.
export const SIGNAL_STRENGTH = {
  plate_skipped: -0.04,
  plate_disliked: -0.35, // on the main's tags, plus hiding the main for DISLIKE_HIDE_DAYS
  plate_saved: 0.15,
  slot_swapped: -0.03, // on the tags of the component swapped away
  cook_started: 0.25,
  market_list_shared: 0.2,
  order_handoff: 0.25,
  ate_it: 0.3,
  taste_game_yum: 0.2,
  taste_game_nah: -0.2,
} as const;

const HALF_LIFE_DAYS = 60; // decay = 0.5 ^ (days since last update / 60)

// a ← clip(a × decay + strength × (1 − |a|), −1, 1). The (1 − |a|) factor stops a tag running away to ±1.
export function updateAffinity(a: number, strength: number, daysSinceUpdate: number): number {
  const decayed = a * 0.5 ** (daysSinceUpdate / HALF_LIFE_DAYS);
  return Math.min(1, Math.max(-1, decayed + strength * (1 - Math.abs(decayed))));
}
