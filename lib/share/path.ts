import { APP_CONFIG as C } from '@/lib/config/app.config';

// Safe for the phone: no server imports here, so the share sheet can use it.
export type ShareCard = { key: string; people: number; title: string; picture: string | null; price: { low: number; high: number; date: string } | null };
export const sharePath = (key: string, people: number) => `/p/${people}/${encodeURIComponent(key)}`;
export const shortDate = (iso: string) => new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', timeZone: C.TIMEZONE }).format(new Date(iso));
