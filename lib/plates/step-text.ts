// Doc 07: a step may hold {ing:egusi-ground}; it reads as the live amount and name for the servings shown (S-005).
// A token for an ingredient the dish doesn't list reads as nothing rather than as code.
export const stepText = (text: string, amount: (id: string) => string | null) =>
  text.replace(/\{ing:([a-z0-9-]{1,80})\}/g, (_, id: string) => amount(id) ?? '').replace(/ {2,}/g, ' ');

// Amounts the way the method shows them: whole numbers from 10, one decimal below.
export const roundAmount = (n: number) => (n >= 10 ? Math.round(n) : Math.round(n * 10) / 10);

// Each heat gets its own token colour so a cook spots a change at a glance (dish page and cook mode).
export const HEAT = { low: 'bg-enamel-100 text-enamel', medium: 'bg-amber-100 text-amber', high: 'bg-scotch-100 text-scotch' } as const;
