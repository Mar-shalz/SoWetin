import { describe, expect, it } from 'vitest';
import { percentile, summarise, type CallRow } from '@/lib/admin/ai-stats';

const row = (task: string, outcome: string, latency_ms: number | null): CallRow => ({ task, outcome, latency_ms, input_tokens: 10, output_tokens: 5, created_at: '2026-11-10T09:00:00Z' });

describe('A-09 AI numbers', () => {
  it('takes nearest-rank percentiles', () => {
    const ms = Array.from({ length: 20 }, (_, i) => (i + 1) * 100);
    expect(percentile(ms, 50)).toBe(1000);
    expect(percentile(ms, 95)).toBe(1900);
    expect(percentile([], 95)).toBeNull();
  });

  it('counts outcomes per task, refusals inside fallbacks, quota apart', () => {
    const [draft] = summarise([row('draft', 'ok', 900), row('draft', 'fallback_refusal', 400), row('draft', 'quota', null), row('draft', 'error', 100)]);
    expect(draft).toEqual({ task: 'draft', calls: 4, ok: 1, fallback: 2, refusal: 1, quota: 1, p50: 400, p95: 900, tokensIn: 40, tokensOut: 20 });
  });
});
