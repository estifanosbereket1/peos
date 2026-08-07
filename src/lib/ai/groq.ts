const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const TIMEOUT_MS = 15_000;

export function isGroqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

/**
 * Call Groq chat completions. Returns parsed JSON when `jsonMode` is true,
 * raw text otherwise. Returns `null` on any failure (missing key, timeout,
 * non-2xx, malformed JSON) so callers can degrade gracefully.
 */
export async function callGroq<Shape = unknown>(
  systemPrompt: string,
  userPrompt: string,
  jsonMode = false,
): Promise<Shape | string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        ...(jsonMode
          ? {
              response_format: { type: "json_object" },
              json: true,
            }
          : {}),
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) return null;
    const data = await res.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) return null;

    if (jsonMode) {
      // Groq may wrap valid JSON in code fences; strip them before parsing.
      const cleaned = content
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
      try {
        return JSON.parse(cleaned) as Shape;
      } catch {
        return null;
      }
    }
    return content.trim();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}