import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { body, display } from '@/app/fonts/fonts';
import { MotionTier } from '@/components/nav/motion-tier';
import { Offline } from '@/components/nav/offline';
import tokens from '@/design/tokens.json';
import '../globals.css';

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
      <body>
        <NextIntlClientProvider>
          <Offline />
          <MotionTier />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
