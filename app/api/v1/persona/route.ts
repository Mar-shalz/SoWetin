import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { personaRead } from '@/lib/ai/persona';
import { publicAi } from '@/lib/ai/public';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { PERSONAS } from '@/lib/engine/persona';
import { LOCALE_COOKIE } from '@/lib/i18n/request';
import { POOL_BY_ID } from '@/lib/play/pool';
import { error } from '@/lib/plates/request';

// POST /api/v1/persona: the AI read for a finished Chop Personality game. Only dish ids from the pool go in, as names.
// No answer from the AI means { line: null }, and the phone keeps the fixed line.
const ids = z.array(z.string().regex(/^[a-z0-9-]{1,80}$/)).max(C.TASTE_GAME_CARDS);
const Body = z.object({ persona: z.enum(PERSONAS), yum: ids, nah: ids }).strict();

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error(400, 'VALIDATION_FAILED', 'Invalid request');
  const ai = publicAi(request.headers);
  const reply = (line: string | null) => Response.json({ line }, { headers: { 'cache-control': 'no-store' } });
  if (!ai) return reply(null);
  const names = (list: string[]) => list.map((id) => POOL_BY_ID.get(id)?.name).filter((n): n is string => !!n);
  const t = await getTranslations({ locale: 'en-NG', namespace: 'persona' });
  const pcm = C.PIDGIN_ENABLED && (await cookies()).get(LOCALE_COOKIE)?.value === 'pcm';
  const { persona, yum, nah } = parsed.data;
  return reply(await personaRead({ persona: t(`${persona}.name`), yum: names(yum), nah: names(nah), lang: pcm ? 'pcm' : 'en' }, ai));
}
