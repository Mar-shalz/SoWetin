import type { MetadataRoute } from 'next';
import tokens from '@/design/tokens.json';
import { APP_CONFIG as C } from '@/lib/config/app.config';

// Add to home screen (PWA shell, doc 15 M2): opens full screen on the Decide screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: C.APP_NAME,
    short_name: C.APP_NAME,
    start_url: '/',
    display: 'standalone',
    background_color: tokens.color.cream.$value,
    theme_color: tokens.color.cream.$value,
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
