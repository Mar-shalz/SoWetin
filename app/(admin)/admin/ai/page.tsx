import { AdminHeader } from '@/components/admin/header';
import { requireStaff } from '@/lib/admin/guard';
import { summarise, type CallRow } from '@/lib/admin/ai-stats';
import { t } from '@/lib/admin/t';
import { CHEF_PROMPT_VERSION } from '@/lib/ai/chef';
import { CRAVING_PROMPT_VERSION } from '@/lib/ai/craving';
import { T3_PROMPT_VERSION } from '@/lib/ai/t3';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { SCOUT_PROMPT_VERSION } from '@/lib/scout/run';

type EvalRun = { id: string; model: string; prompt_version: string; passed: boolean; created_at: string };
const LIMIT = 1000;
const TASKS = ['craving', 'chef', 'draft', 'scout'] as const;
type Task = (typeof TASKS)[number];

// A-09 AI (doc 02): prompt versions in use, calls, latency, fallback and refusal rates, and eval runs. Admins only.
// No user text is shown here, only counts and timings.
// shortcut: app users' craving and Chef calls aren't logged yet (that needs a server key or anonymous profiles), the free
// tier has no cost to chart, and eval runs appear once `pnpm eval:ai` has somewhere to write them.
export default async function AiPage() {
  const { supabase, user, role } = await requireStaff();
  const admin = role === 'admin';
  const [{ data: calls }, { data: evals }] = admin
    ? await Promise.all([
        supabase.from('ai_calls').select('task, outcome, latency_ms, input_tokens, output_tokens, created_at').order('created_at', { ascending: false }).limit(LIMIT),
        supabase.from('ai_eval_runs').select('id, model, prompt_version, passed, created_at').order('created_at', { ascending: false }).limit(20),
      ])
    : [{ data: [] }, { data: [] }];
  const stats = summarise((calls ?? []) as CallRow[]);
  const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '0%');
  const secs = (ms: number | null) => (ms === null ? '' : t('ai.seconds', { s: (ms / 1000).toFixed(1) }));
  const when = (iso: string) =>
    new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: C.TIMEZONE }).format(new Date(iso));
  const prompts = [
    ['craving', CRAVING_PROMPT_VERSION, C.AI_MODEL_RUNTIME],
    ['chef', CHEF_PROMPT_VERSION, C.AI_MODEL_RUNTIME],
    ['draft', T3_PROMPT_VERSION, C.AI_MODEL_AUTHORING],
    ['scout', SCOUT_PROMPT_VERSION, C.AI_MODEL_AUTHORING],
  ] as const;
  const th = 'border-b border-line py-2 pr-4 text-left type-label';
  const td = 'border-b border-line py-2 pr-4';
  return (
    <>
      <AdminHeader email={user.email} />
      <main className="grid gap-8">
        <h1 className="type-title-l">{t('ai.title')}</h1>
        {!admin ? (
          <p className="text-ink-2">{t('prices.adminOnly')}</p>
        ) : (
          <>
            <section aria-labelledby="ai-prompts">
              <h2 id="ai-prompts" className="type-title-m">
                {t('ai.prompts')}
              </h2>
              <table className="mt-2 w-full">
                <thead>
                  <tr>
                    <th className={th}>{t('ai.task')}</th>
                    <th className={th}>{t('ai.version')}</th>
                    <th className={th}>{t('ai.model')}</th>
                  </tr>
                </thead>
                <tbody>
                  {prompts.map(([task, version, model]) => (
                    <tr key={task}>
                      <td className={td}>{t(`ai.tasks.${task}`)}</td>
                      <td className={td}>{version}</td>
                      <td className={td}>{model}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section aria-labelledby="ai-calls">
              <h2 id="ai-calls" className="type-title-m">
                {t('ai.calls', { count: calls?.length ?? 0 })}
              </h2>
              <p className="mt-1 type-caption text-ink-2">{t('ai.callsNote')}</p>
              {stats.length ? (
                <div className="overflow-x-auto">
                  <table className="mt-2 w-full">
                    <thead>
                      <tr>
                        {(['task', 'count', 'ok', 'fallback', 'refusal', 'quota', 'p50', 'p95', 'tokens'] as const).map((k) => (
                          <th key={k} className={th}>
                            {t(`ai.col.${k}`)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.map((s) => (
                        <tr key={s.task}>
                          <td className={td}>{TASKS.includes(s.task as Task) ? t(`ai.tasks.${s.task as Task}`) : s.task}</td>
                          <td className={td}>{s.calls}</td>
                          <td className={td}>{pct(s.ok, s.calls)}</td>
                          <td className={td}>{pct(s.fallback, s.calls)}</td>
                          <td className={td}>{pct(s.refusal, s.calls)}</td>
                          <td className={td}>{s.quota}</td>
                          <td className={td}>{secs(s.p50)}</td>
                          <td className={td}>{secs(s.p95)}</td>
                          <td className={td}>{t('ai.tokens', { in: s.tokensIn, out: s.tokensOut })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-2 text-ink-2">{t('ai.noCalls')}</p>
              )}
            </section>
            <section aria-labelledby="ai-evals">
              <h2 id="ai-evals" className="type-title-m">
                {t('ai.evals')}
              </h2>
              {evals?.length ? (
                <ul className="mt-2 grid gap-2">
                  {(evals as EvalRun[]).map((e) => (
                    <li key={e.id}>
                      {when(e.created_at)} · {e.model} · {e.prompt_version} · {e.passed ? t('ai.passed') : t('ai.failed')}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-ink-2">{t('ai.noEvals')}</p>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
