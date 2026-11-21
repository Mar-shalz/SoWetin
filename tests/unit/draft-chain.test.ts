import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { draftJson } from '@/lib/ai/draft-chain';

const call = { system: 's', prompt: 'p', schema: { type: 'object', properties: { ok: { type: 'boolean' } } }, timeoutMs: 1000 };
const gem = { key: 'gem-key', model: 'gemini-test' };
const reply = (json: unknown) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(json) }, finish_reason: 'stop' }], usage: { prompt_tokens: 5, completion_tokens: 7 } }), { status: 200 });
const geminiReply = (json: unknown) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] }, finishReason: 'STOP' }] }), { status: 200 });
const quota = () => new Response('{}', { status: 429 });

describe('free draft chain: Groq, then Mistral, then Gemini', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.GROQ_API_KEY = 'groq-test';
    process.env.MISTRAL_API_KEY = 'mistral-test';
  });
  afterEach(() => {
    delete process.env.GROQ_API_KEY;
    delete process.env.MISTRAL_API_KEY;
    vi.restoreAllMocks();
  });

  it('uses Groq first and never calls the others when Groq answers', async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => reply({ ok: true }));
    const r = await draftJson(call, gem, f as unknown as typeof fetch);
    expect(r).toMatchObject({ ok: true, json: { ok: true }, usage: { input: 5, output: 7 } });
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toContain('api.groq.com');
    expect(init?.headers).toMatchObject({ authorization: 'Bearer groq-test' });
  });

  it('falls to Mistral on Groq quota, then to Gemini when Mistral also fails', async () => {
    const f = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('groq')) return quota();
      if (u.includes('mistral')) return quota();
      return geminiReply({ ok: true });
    });
    const r = await draftJson(call, gem, f as unknown as typeof fetch);
    expect(r).toMatchObject({ ok: true, json: { ok: true } });
    expect(f.mock.calls.map((c) => String(c[0]).split('/')[2])).toEqual(['api.groq.com', 'api.mistral.ai', 'generativelanguage.googleapis.com']);
  });

  it('falls to Cerebras on Groq quota and never calls Gemini when Cerebras answers', async () => {
    process.env.CEREBRAS_API_KEY = 'cerebras-test';
    const f = vi.fn(async (url: string | URL | Request) => (String(url).includes('groq') ? quota() : reply({ ok: true })));
    const r = await draftJson(call, gem, f as unknown as typeof fetch);
    expect(r).toMatchObject({ ok: true, json: { ok: true } });
    expect(f.mock.calls.map((c) => String(c[0]).split('/')[2])).toEqual(['api.groq.com', 'api.cerebras.ai']);
    delete process.env.CEREBRAS_API_KEY;
  });

  it('returns quota when every provider is out of quota', async () => {
    const f = vi.fn(async () => quota());
    expect(await draftJson(call, gem, f as unknown as typeof fetch)).toMatchObject({ ok: false, reason: 'quota' });
  });

  it('skips a provider without a key', async () => {
    delete process.env.GROQ_API_KEY;
    delete process.env.MISTRAL_API_KEY;
    const f = vi.fn(async (_u: string, _i?: RequestInit) => geminiReply({ ok: true }));
    expect(await draftJson(call, gem, f as unknown as typeof fetch)).toMatchObject({ ok: true });
    expect(f).toHaveBeenCalledTimes(1);
  });
});
