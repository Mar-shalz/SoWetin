// A-09 numbers from the ai_calls log (doc 14, section 4 "AI"): calls, latency P50 and P95, fallback and refusal rates.
export type CallRow = { task: string; outcome: string; latency_ms: number | null; input_tokens: number | null; output_tokens: number | null; created_at: string };
export type TaskStats = { task: string; calls: number; ok: number; fallback: number; refusal: number; quota: number; p50: number | null; p95: number | null; tokensIn: number; tokensOut: number };

// Nearest-rank percentile over the calls that recorded a latency.
export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

export function summarise(rows: CallRow[]): TaskStats[] {
  const by = new Map<string, CallRow[]>();
  for (const r of rows) by.set(r.task, [...(by.get(r.task) ?? []), r]);
  return [...by].map(([task, list]) => {
    const ms = list.map((r) => r.latency_ms).filter((n): n is number => n !== null);
    return {
      task,
      calls: list.length,
      ok: list.filter((r) => r.outcome === 'ok').length,
      fallback: list.filter((r) => r.outcome.startsWith('fallback_') || r.outcome === 'error').length,
      refusal: list.filter((r) => r.outcome === 'fallback_refusal').length,
      quota: list.filter((r) => r.outcome === 'quota').length,
      p50: percentile(ms, 50),
      p95: percentile(ms, 95),
      tokensIn: list.reduce((s, r) => s + (r.input_tokens ?? 0), 0),
      tokensOut: list.reduce((s, r) => s + (r.output_tokens ?? 0), 0),
    };
  });
}
