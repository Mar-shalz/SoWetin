'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useSyncExternalStore } from 'react';

const subscribe = (cb: () => void) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
};

// Registers the offline worker once, and says so when the phone loses its network (doc 11: offline.banner).
export function Offline() {
  const t = useTranslations();
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') void navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return online ? null : (
    <p role="status" className="sticky top-0 z-20 bg-ink px-4 py-2 text-center type-caption text-cream">
      {t('offline.banner')}
    </p>
  );
}
