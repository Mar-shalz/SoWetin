import { getLocale, getTranslations } from 'next-intl/server';
import type { AllergenGroup } from '@/lib/plates/allergens';

// S-004 item 9 and S-011: what the recipe contains and may contain, from our own recipe lines. In Pidgin the English
// line follows the Pidgin one (BR-114), because allergy text has to be exact.
export async function AllergenLine({ contains, may }: { contains: AllergenGroup[]; may: AllergenGroup[] }) {
  if (!contains.length && !may.length) return null;
  const locale = await getLocale();
  const [t, en] = await Promise.all([getTranslations(), locale === 'pcm' ? getTranslations({ locale: 'en-NG' }) : null]);
  const list = (tr: typeof t, groups: AllergenGroup[]) =>
    groups.map((g) => `${tr.has(`allergen.${g.tag}`) ? tr(`allergen.${g.tag}`) : g.tag} (${g.items.join(', ')})`).join(', ');
  const line = (key: 'detail.allergens.contains' | 'detail.allergens.may', groups: AllergenGroup[]) =>
    !!groups.length && (
      <p>
        {t(key, { list: list(t, groups) })}
        {en && <span className="block text-ink-2">{en(key, { list: list(en, groups) })}</span>}
      </p>
    );
  return (
    <section className="grid gap-1 rounded-md border border-line p-3">
      {line('detail.allergens.contains', contains)}
      {line('detail.allergens.may', may)}
    </section>
  );
}
