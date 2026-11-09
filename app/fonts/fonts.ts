import localFont from 'next/font/local';

// Self-hosted subsets from scripts/subset-fonts.sh, shared by both root layouts. Only the body file is preloaded (doc 12, section 2).
export const display = localFont({ src: './bricolage-grotesque.woff2', variable: '--nf-display', weight: '600 800', display: 'swap', preload: false });
export const body = localFont({ src: './plus-jakarta-sans.woff2', variable: '--nf-body', weight: '400 800', display: 'swap' });
