import { AdminHeader } from '@/components/admin/header';
import { requireStaff } from '@/lib/admin/guard';
import { t } from '@/lib/admin/t';
import { APP_CONFIG as C } from '@/lib/config/app.config';

type Entry = { id: number; actor: string | null; action: string; entity: string; entity_id: string | null; before: unknown; after: unknown; at: string };
const LIMIT = 100;

// A-10 Settings and audit log (doc 02). Settings show the values the app runs on; every change anyone made is listed.
// shortcut: settings are read-only; admin overrides (app_config, lib/config/resolve.ts) need a server-side reader first.
export default async function SettingsPage() {
  const { supabase, user, role } = await requireStaff();
  const { data } =
    role === 'admin'
      ? await supabase.from('audit_log').select('id, actor, action, entity, entity_id, before, after, at').order('at', { ascending: false }).limit(LIMIT)
      : { data: [] };
  const entries = (data ?? []) as Entry[];
  const when = (iso: string) =>
    new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: C.TIMEZONE }).format(new Date(iso));
  return (
    <>
      <AdminHeader email={user.email} />
      <main className="grid gap-8">
        <section aria-labelledby="audit">
          <h1 id="audit" className="type-title-l">
            {t('settings.auditTitle')}
          </h1>
          {role !== 'admin' ? (
            <p className="mt-2 text-ink-2">{t('prices.adminOnly')}</p>
          ) : (
            <ul className="mt-4 grid gap-2">
              {entries.map((e) => (
                <li key={e.id} className="rounded-md border border-line bg-surface p-3">
                  <p>
                    <span className="type-label">{when(e.at)}</span> · {e.action} · {e.entity} · {e.entity_id}
                    <span className="text-ink-2"> · {e.actor === user.id ? t('settings.you') : e.actor ? e.actor.slice(0, 8) : t('settings.system')}</span>
                  </p>
                  <details>
                    <summary className="min-h-12 cursor-pointer py-3 text-enamel underline">{t('settings.details')}</summary>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-all type-caption">
                      {JSON.stringify({ before: e.before, after: e.after }, null, 1)}
                    </pre>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="settings">
          <h2 id="settings" className="type-title-l">
            {t('settings.title')}
          </h2>
          <p className="mt-2 text-ink-2">{t('settings.intro')}</p>
          <dl className="mt-4 grid gap-1 md:grid-cols-2">
            {Object.entries(C).map(([k, v]) => (
              <div key={k} className="border-b border-line py-2">
                <dt className="type-label">{k}</dt>
                <dd className="break-all type-caption text-ink-2">{JSON.stringify(v)}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </>
  );
}
