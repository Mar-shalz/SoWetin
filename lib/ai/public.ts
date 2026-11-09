import { APP_CONFIG as C } from '@/lib/config/app.config';

// Tap-time AI for app users (craving parse, Ask Chef) on Gemini's free tier (D-31, D-36).
// - Its own key, GEMINI_PUBLIC_API_KEY, from a separate Google project: app traffic can't use up the admin key's daily
//   quota, and a project with no billing account can never run up a bill.
// - Google's free tier may not serve people in the EEA, Switzerland or the UK, so they get the no-AI path.
// shortcut: no per-person daily quota (BR-64) yet; it needs anonymous profiles or Upstash. Until then Google's own free
// limit is the cap, and every caller falls back cleanly when it's reached.
const NO_FREE_AI = new Set(
  'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO CH GB'.split(' '),
);

export function publicAi(request: Request, timeoutMs: number = C.AI_PARSE_TIMEOUT_MS) {
  const key = process.env.GEMINI_PUBLIC_API_KEY;
  // Vercel sets the country header; without it (local runs) we can't tell, so we stay on the safe side only in production.
  const country = request.headers.get('x-vercel-ip-country');
  if (!key || (country ? NO_FREE_AI.has(country) : process.env.VERCEL === '1')) return null;
  return { key, model: C.AI_MODEL_RUNTIME, timeoutMs, thinking: C.AI_RUNTIME_THINKING };
}
