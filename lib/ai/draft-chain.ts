import { APP_CONFIG as C } from '@/lib/config/app.config';
import { geminiJson, geminiSchema, type GeminiCall, type GeminiResult } from './gemini';

// Free AI for T3 drafts: Groq first, Mistral next, Gemini last. A provider is used only when its key is set,
// and the next one takes over when it fails (quota, timeout, bad answer). Server only: keys never reach a page.
export type PlainCall = { system: string; prompt: string; schema: unknown; timeoutMs: number };
type Provider = (c: PlainCall, fetchFn: typeof fetch) => Promise<GeminiResult>;

// Groq and Mistral speak the OpenAI chat format. They have no JSON Schema field here, so the schema goes in the
// system text and Zod checks the answer afterwards.
async function chatJson(url: string, key: string, model: string, c: PlainCall, fetchFn: typeof fetch): Promise<GeminiResult> {
  const started = Date.now();
  const latency = () => Date.now() - started;
  let res: Response;
  try {
    res = await fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature: C.AI_DRAFT_TEMPERATURE,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: `${c.system}\n\nReply with only a JSON object that matches this JSON Schema:\n${JSON.stringify(c.schema)}` },
          { role: 'user', content: c.prompt },
        ],
      }),
      signal: AbortSignal.timeout(c.timeoutMs),
    });
  } catch (e) {
    return { ok: false, reason: e instanceof Error && e.name === 'TimeoutError' ? 'timeout' : 'failed', latencyMs: latency() };
  }
  if (!res.ok) {
    // The provider's error body never echoes the key.
    console.error('draft', new URL(url).host, res.status, (await res.text().catch(() => '')).slice(0, 500));
    return { ok: false, reason: res.status === 429 ? 'quota' : 'failed', latencyMs: latency() };
  }
  const body = (await res.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const cand = body.choices?.[0];
  const usage = { input: body.usage?.prompt_tokens, output: body.usage?.completion_tokens };
  const stop = cand?.finish_reason ?? 'NONE';
  const text = cand?.message?.content ?? '';
  if (stop !== 'stop' || !text) return { ok: false, reason: 'stopped', stop, latencyMs: latency(), usage };
  try {
    return { ok: true, json: JSON.parse(text), stop: 'STOP', latencyMs: latency(), usage };
  } catch {
    return { ok: false, reason: 'invalid', stop, latencyMs: latency(), usage };
  }
}

// Tries each configured provider in order. Returns the first good answer, or the last failure.
export async function draftJson(c: PlainCall, gemini: { key: string; model: string }, fetchFn: typeof fetch = fetch): Promise<GeminiResult> {
  const providers: Provider[] = [];
  const groq = process.env.GROQ_API_KEY;
  const mistral = process.env.MISTRAL_API_KEY;
  const cerebras = process.env.CEREBRAS_API_KEY;
  const cfKey = process.env.CLOUDFLARE_API_KEY;
  const cfAccount = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (groq) providers.push((x, f) => chatJson('https://api.groq.com/openai/v1/chat/completions', groq, C.AI_GROQ_MODEL, x, f));
  if (cerebras) providers.push((x, f) => chatJson('https://api.cerebras.ai/v1/chat/completions', cerebras, C.AI_CEREBRAS_MODEL, x, f));
  // shortcut: Cloudflare needs CLOUDFLARE_ACCOUNT_ID in the URL, so it is skipped until that is set.
  if (cfKey && cfAccount) providers.push((x, f) => chatJson(`https://api.cloudflare.com/client/v4/accounts/${cfAccount}/ai/v1/chat/completions`, cfKey, C.AI_CLOUDFLARE_MODEL, x, f));
  if (mistral) providers.push((x, f) => chatJson('https://api.mistral.ai/v1/chat/completions', mistral, C.AI_MISTRAL_MODEL, x, f));
  if (gemini.key) providers.push((x, f) => geminiJson({ ...gemini, ...x, schema: geminiSchema(x.schema) } as GeminiCall, f));

  let last: GeminiResult = { ok: false, reason: 'failed', latencyMs: 0 };
  for (const run of providers) {
    last = await run(c, fetchFn);
    if (last.ok) return last;
  }
  return last;
}
