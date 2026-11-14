// Dish pictures from OpenAI's image API (Victor, 14 November 2026: his OPENAI_API_KEY, paid per image).
// A photo-style picture of the dish as it's served in Nigeria. Staff can replace it any time in A-03.
export async function dishPicture(name: string, key: string, model: string, fetchFn: typeof fetch = fetch): Promise<Uint8Array | null> {
  const prompt = `Overhead food photo of ${name}, the Nigerian dish, served the way it is eaten at home in Lagos, on a plain enamel plate or bowl, daylight, no text, no people, no hands.`;
  try {
    const res = await fetchFn('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, prompt, size: '1024x1024', quality: 'low', output_format: 'webp', n: 1 }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      console.error('openai image', res.status, (await res.text().catch(() => '')).slice(0, 300));
      return null;
    }
    const b64 = ((await res.json()) as { data?: { b64_json?: string }[] }).data?.[0]?.b64_json;
    return b64 ? Uint8Array.from(Buffer.from(b64, 'base64')) : null;
  } catch {
    return null;
  }
}
