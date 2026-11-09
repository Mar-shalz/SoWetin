import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { getLocale, getTranslations } from 'next-intl/server';
import tokens from '@/design/tokens.json';
import '../globals.css';

// Self-hosted subsets from scripts/subset-fonts.sh. Only the body file is preloaded (doc 12, section 2).
const display = localFont({ src: '../fonts/bricolage-grotesque.woff2', variable: '--nf-display', weight: '600 800', display: 'swap', preload: false });
const body = localFont({ src: '../fonts/plus-jakarta-sans.woff2', variable: '--nf-body', weight: '400 800', display: 'swap' });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta');
  return { title: t('title'), description: t('description') };
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: tokens.color.cream.$value };

// Root layout for the app itself. Public pages (dish pages, legal, shared plates) get their own
// English-only root layout later, so reading the language cookie here never makes them dynamic.
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang={await getLocale()} className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
