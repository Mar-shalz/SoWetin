import type { Metadata } from 'next';
import { body, display } from '@/app/fonts/fonts';
import { t } from '@/lib/admin/t';
import '../globals.css';

// Root layout for the staff admin (doc 02, A-01 to A-10): English only, desktop first, never indexed.
export const metadata: Metadata = { title: t('meta.title'), robots: { index: false, follow: false } };
// Rendered per request, so every page carries the CSP nonce from proxy.ts (a static page can't, and its scripts get blocked).
export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" className={`${display.variable} ${body.variable}`}>
      <body>
        <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
      </body>
    </html>
  );
}
