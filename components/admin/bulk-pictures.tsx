'use client';

import { useState } from 'react';
import { uploadPicture } from '@/app/(admin)/admin/actions';
import { t } from '@/lib/admin/t';

// Pick a whole folder of pictures named after dish slugs (egusi-soup.jpg); each goes up through the same checks as a
// single upload (type, size). Victor, 14 November 2026.
export function BulkPictures() {
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  async function upload(files: FileList | null) {
    const list = [...(files ?? [])];
    setTotal(list.length);
    setDone(0);
    setFailed([]);
    for (const file of list) {
      const form = new FormData();
      form.set('id', file.name.replace(/\.[^.]+$/, '').toLowerCase());
      form.set('picture', file);
      const r = await uploadPicture({}, form).catch(() => ({ error: 'x' }));
      if (r?.error) setFailed((f) => [...f, file.name]);
      setDone((n) => n + 1);
    }
  }
  return (
    <section className="mt-6 rounded-lg border border-line bg-surface p-5" aria-labelledby="bulk-pictures">
      <h2 id="bulk-pictures" className="type-title-m">
        {t('bulkPictures.title')}
      </h2>
      <p className="mt-1 text-ink-2">{t('bulkPictures.body')}</p>
      <input type="file" multiple accept="image/webp,image/png,image/jpeg,image/avif" onChange={(e) => upload(e.target.files)} className="mt-3 block" />
      {!!total && (
        <p className="mt-2 type-label" aria-live="polite">
          {t('bulkPictures.progress', { done, total })}
        </p>
      )}
      {!!failed.length && <p className="mt-1 text-scotch">{t('bulkPictures.failed', { list: failed.join(', ') })}</p>}
    </section>
  );
}
