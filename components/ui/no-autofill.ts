// Spread on every text field. Victor: no password, card or other autofill hints on the keyboard until he says so (Nov 2026).
export const NO_AUTOFILL = {
  autoComplete: 'off',
  autoCorrect: 'off',
  spellCheck: false,
  'aria-autocomplete': 'none',
  'data-lpignore': 'true',
  'data-1p-ignore': true,
  'data-bwignore': 'true',
  'data-form-type': 'other',
} as const;
