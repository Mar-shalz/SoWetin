import { getTranslations } from 'next-intl/server';
import { BottomNav } from '@/components/nav/bottom-nav';
import { SavedLists } from './saved-lists';

export default async function SavedPage() {
  const t = await getTranslations();
  return (
    <main className="mx-auto flex min-h-dvh max-w-app flex-col gap-4 px-4 pt-6">
      <h1 className="type-display-l">{t('nav.saved')}</h1>
      <p className="type-caption text-ink-2">{t('saved.onPhone')}</p>
      <SavedLists />
      <div className="mt-auto" />
      <BottomNav current="saved" />
    </main>
  );
}
