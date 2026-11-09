// Google's Gemini API on the free tier (Victor, 9 November 2026: no paid AI yet). Server only: the key never
// reaches a page. Uses generateContent with a JSON Schema, then the caller validates the answer again with Zod.
// thinking: Gemini 3 thinking level; "minimal" keeps tap-time calls fast (ai.google.dev/gemini-api/docs/thinking).
export type GeminiCall = { model: string; key: string; system: string; prompt: string; schema: unknown; timeoutMs: number; thinking?: 'minimal' | 'low' | 'medium' | 'high' };
export type GeminiUsage = { input?: number; output?: number };
export type GeminiResult =
  | { ok: true; json: unknown; stop: string; latencyMs: number; usage: GeminiUsage }
  | { ok: false; reason: 'quota' | 'timeout' | 'failed' | 'stopped' | 'invalid'; stop?: string; latencyMs: number; usage?: GeminiUsage };

type Answer = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
};

export async function geminiJson(c: GeminiCall, fetchFn: typeof fetch = fetch): Promise<GeminiResult> {
  const started = Date.now();
  const latency = () => Date.now() - started;
  let res: Response;
  try {
    res = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(c.model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': c.key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: c.system }] },
        contents: [{ role: 'user', parts: [{ text: c.prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: c.schema,
          ...(c.thinking && { thinkingConfig: { thinkingLevel: c.thinking } }),
        },
      }),
      signal: AbortSignal.timeout(c.timeoutMs),
    });
  } catch (e) {
    return { ok: false, reason: e instanceof Error && e.name === 'TimeoutError' ? 'timeout' : 'failed', latencyMs: latency() };
  }
  if (!res.ok) {
    // Google's error body says what went wrong (quota, model name, schema) and never echoes the key.
    console.error('gemini', res.status, (await res.text().catch(() => '')).slice(0, 500));
    return { ok: false, reason: res.status === 429 ? 'quota' : 'failed', latencyMs: latency() };
  }
  const body = (await res.json().catch(() => ({}))) as Answer;
  const cand = body.candidates?.[0];
  const stop = cand?.finishReason ?? 'NONE';
  const usage = {
    input: body.usageMetadata?.promptTokenCount,
    output: (body.usageMetadata?.candidatesTokenCount ?? 0) + (body.usageMetadata?.thoughtsTokenCount ?? 0) || undefined,
  };
  const text = (cand?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('');
  if (stop !== 'STOP' || !text) return { ok: false, reason: 'stopped', stop, latencyMs: latency(), usage };
  try {
    return { ok: true, json: JSON.parse(text), stop, latencyMs: latency(), usage };
  } catch {
    return { ok: false, reason: 'invalid', stop, latencyMs: latency(), usage };
  }
}

// Gemini accepts a subset of JSON Schema. Keep the keywords it documents and drop the rest; Zod still checks
// the dropped ones (lengths, extra keys) when the answer comes back.
const KEEP = new Set(['type', 'properties', 'required', 'items', 'enum', 'minimum', 'maximum', 'minItems', 'maxItems', 'description']);
export function geminiSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(geminiSchema);
  if (!node || typeof node !== 'object') return node;
  return Object.fromEntries(
    Object.entries(node)
      .filter(([k]) => KEEP.has(k))
      .map(([k, v]) => [k, k === 'properties' ? Object.fromEntries(Object.entries(v as object).map(([p, s]) => [p, geminiSchema(s)])) : geminiSchema(v)]),
  );
}
