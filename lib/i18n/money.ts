const NAIRA = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 });

// "₦2,500": naira sign, comma thousands, no decimals (NFR-10). Same in both languages.
export const formatNaira = (amount: number) => `₦${NAIRA.format(Math.round(amount))}`;
