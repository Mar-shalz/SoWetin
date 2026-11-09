// Display rounding (doc 04, section 4.3): the range opens outwards, "about" figures go to the nearest step.
export const roundDown = (n: number, step: number) => Math.floor(n / step) * step;
export const roundUp = (n: number, step: number) => Math.ceil(n / step) * step;
export const roundNearest = (n: number, step: number) => Math.round(n / step) * step;

const DAY = 86_400_000;
export const daysBetween = (fromIso: string, toIso: string) => Math.round((Date.parse(toIso) - Date.parse(fromIso)) / DAY);
