import { ActionForm } from '@/components/admin/action-form';
import { Choice, Input } from '@/components/admin/fields';
import { AdminHeader } from '@/components/admin/header';
import { requireStaff } from '@/lib/admin/guard';
import { t } from '@/lib/admin/t';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { addVideo, changeVideo } from './actions';

type Video = {
  id: string;
  component_id: string;
  youtube_id: string;
  title: string;
  channel_title: string;
  duration_seconds: number | null;
  language: string;
  rank: number | null;
};
const LANGUAGES = ['en', 'pcm', 'yo', 'ig', 'ha', 'other'] as const;

// A-05 Videos (doc 05, section 7): paste a YouTube link per dish, order them (the first is the primary), hide broken ones.
// shortcut: no candidate search or weekly health check yet; both need a YouTube API key and a scheduled job.
export default async function VideosPage() {
  const { supabase, user } = await requireStaff();
  const [{ data: comps }, { data: vids }] = await Promise.all([
    supabase.from('components').select('id, name').order('name'),
    supabase
      .from('videos')
      .select('id, component_id, youtube_id, title, channel_title, duration_seconds, language, rank')
      .eq('status', 'approved')
      .order('rank'),
  ]);
  const videos = (vids ?? []) as Video[];
  const byDish = new Map<string, Video[]>();
  for (const v of videos) byDish.set(v.component_id, [...(byDish.get(v.component_id) ?? []), v]);
  const dishes = (comps ?? []) as { id: string; name: string }[];
  return (
    <>
      <AdminHeader email={user.email} />
      <main className="grid gap-8">
        <div>
          <h1 className="type-title-l">{t('videos.title')}</h1>
          <p className="mt-2 text-ink-2">{t('videos.intro', { max: C.MAX_VIDEOS_PER_COMPONENT })}</p>
        </div>
        <ActionForm
          action={addVideo}
          submit={t('videos.add')}
          pending={t('videos.adding')}
          className="grid gap-3 rounded-lg border border-line bg-surface p-5 md:grid-cols-2"
        >
          <Choice label={t('videos.dish')} name="component_id" options={dishes.map((d): [string, string] => [d.id, d.name])} />
          <Input label={t('videos.link')} name="url" required placeholder="https://www.youtube.com/watch?v=" />
          <Choice label={t('videos.language')} name="language" options={LANGUAGES.map((l): [string, string] => [l, t(`videos.languages.${l}`)])} />
          <Input label={t('videos.minutes')} name="minutes" inputMode="numeric" />
        </ActionForm>
        <ul className="grid gap-4">
          {dishes
            .filter((d) => byDish.has(d.id))
            .map((d) => (
              <li key={d.id} className="rounded-lg border border-line bg-surface p-4">
                <p className="type-label">{d.name}</p>
                <ol className="mt-2 grid gap-2">
                  {byDish.get(d.id)!.map((v, i) => (
                    <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-2">
                      <span>
                        {i === 0 ? `${t('videos.primary')} · ` : ''}
                        {v.title}{' '}
                        <span className="text-ink-2">
                          · {v.channel_title} · {t(`videos.languages.${v.language as (typeof LANGUAGES)[number]}`)}
                        </span>
                      </span>
                      <span className="flex gap-2">
                        {i > 0 && (
                          <ActionForm quiet action={changeVideo} submit={t('videos.up')} pending="…">
                            <input type="hidden" name="id" value={v.id} />
                            <input type="hidden" name="component_id" value={d.id} />
                            <input type="hidden" name="op" value="up" />
                          </ActionForm>
                        )}
                        <ActionForm quiet action={changeVideo} submit={t('videos.hide')} pending="…">
                          <input type="hidden" name="id" value={v.id} />
                          <input type="hidden" name="component_id" value={d.id} />
                          <input type="hidden" name="op" value="hide" />
                        </ActionForm>
                      </span>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
        </ul>
      </main>
    </>
  );
}
