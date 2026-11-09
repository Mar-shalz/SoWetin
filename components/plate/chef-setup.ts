import { headers } from 'next/headers';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ChefEnglish } from '@/components/plate/ask-chef';
import { publicAi } from '@/lib/ai/public';
import { APP_CONFIG as C } from '@/lib/config/app.config';

// Ask Chef shows only where it can answer, so nobody meets a dead end (BR-63): the flag is on, the key is set and the
// free tier serves this country. In Pidgin, the safety lines also come in English (BR-114).
export async function chefSetup(allergens: string[]): Promise<{ on: boolean; en: ChefEnglish }> {
  const on = C.CHEF_ENABLED && !!publicAi(await headers(), C.AI_CHEF_TIMEOUT_MS);
  if (!on || (await getLocale()) !== 'pcm') return { on, en: null };
  const en = await getTranslations({ locale: 'en-NG' });
  return {
    on,
    en: {
      note: en('ai.note.chef'),
      medical: en('chef.medical'),
      allergy: en.raw('chef.allergyWarning') as string,
      allergens: Object.fromEntries(allergens.map((a) => [a, en.has(`allergen.${a}`) ? en(`allergen.${a}`) : a])),
    },
  };
}
