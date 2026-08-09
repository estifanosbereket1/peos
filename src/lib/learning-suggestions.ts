import { todayKey } from "@/lib/time";
import { callGroq } from "@/lib/ai/groq";

/**
 * Learning topic suggestions for a day.
 *
 * Sources: the user's own `learning_topics` pool + a fixed set of broad dev
 * categories that rotate deterministically with the date (first 3), then up to
 * 2 Groq-suggested topics drawn from the user's recent learning history.
 * If Groq is unavailable or there's too little history, the remaining slots
 * fall back to more rotating categories — never an error surfaced to the user.
 */

export type Suggestion = {
  topic: string;
  source: "suggestion" | "user" | "ai";
  reason?: string; // one-line "why this, now" for ai suggestions
};

export type HistoryEntry = {
  topic: string;
  content: string | null;
  explainBack?: string | null;
};

const ROTATING_CATEGORIES = [
  "Algorithms: sorting & searching",
  "System design: scaling a web service",
  "Language internals: memory model",
  "SQL: query optimization",
  "Profiling & performance",
  "Networking basics",
  "Concurrency & threading",
  "REST vs RPC design",
  "Testing strategies",
  "Observability: logging, metrics, traces",
] as const;

const STATIC_COUNT = 3;

type AiSuggestion = { topic: string; reason: string };

const AI_SYSTEM_PROMPT = `You are a study companion. Given a learner's recent learning-log entries, suggest the next 2 topics to study next.

Rules:
- Topics must be concrete and specific (e.g. "React Server Components: streaming & Suspense", not "frontend").
- Each must build on or connect to what they already logged.
- Reasons are one short line explaining "why this, now" — reference their actual entries.
- Output STRICT JSON: {"suggestions":[{"topic":"...","reason":"..."}]}.
- No preamble, no markdown, no free text outside the JSON.`;

/** Ask Groq for 2 next topics based on recent history. Returns [] on any failure. */
async function aiSuggestAsync(history: HistoryEntry[]): Promise<AiSuggestion[]> {
  if (history.length < 3) return [];
  const past = history
    .map((h) => {
      const parts = [h.topic, h.content];
      if (h.explainBack?.trim()) parts.push(`taught back: ${h.explainBack}`);
      return parts.join(" — ");
    })
    .join("\n");
  const res = await callGroq<{ suggestions?: AiSuggestion[] }>(
    AI_SYSTEM_PROMPT,
    `Recent learning log entries (newest last):\n${past}`,
    true,
  );
  const list = (res as { suggestions?: AiSuggestion[] } | null)?.suggestions;
  if (!Array.isArray(list)) return [];
  return list
    .filter((s) => s && typeof s.topic === "string" && s.topic.trim())
    .slice(0, 2)
    .map((s) => ({
      topic: s.topic.trim(),
      reason: typeof s.reason === "string" ? s.reason.trim() : "",
    }));
}

/** Rotate the base categories by calendar day & offset by year-month so the
 * set feels fresh but is stable within a single day. */
export function rotatingCategoriesFor(dayKey: string): string[] {
  const noon = new Date(`${dayKey}T12:00:00`);
  const dayOfYear = Math.floor(
    (noon.getTime() - new Date(noon.getFullYear(), 0, 1).getTime()) / 86_400_000,
  );
  const start = dayOfYear % ROTATING_CATEGORIES.length;
  return Array.from(
    { length: 5 },
    (_, i) => ROTATING_CATEGORIES[(start + i) % ROTATING_CATEGORIES.length],
  );
}

export async function getSuggestionsForDay(
  dayKey: string,
  userTopics: string[],
  history: HistoryEntry[] = [],
): Promise<Suggestion[]> {
  const cats = rotatingCategoriesFor(dayKey);
  const ai = await aiSuggestAsync(history);

  const seen = new Set<string>();
  const out: Suggestion[] = [];

  const push = (topic: string, source: Suggestion["source"], reason?: string) => {
    const t = topic.trim();
    if (!t || seen.has(t.toLowerCase())) return;
    seen.add(t.toLowerCase());
    out.push(reason ? { topic: t, source, reason } : { topic: t, source });
  };

  // User-maintained pool + rotating categories fill the first STATIC_COUNT.
  for (const topic of userTopics) push(topic, "user");
  for (const cat of cats) push(cat, "suggestion");
  const staticSlice = out.slice(0, STATIC_COUNT);
  out.length = 0;
  for (const s of staticSlice) out.push(s);

  // Up to 2 Groq-suggested topics.
  for (const s of ai) push(s.topic, "ai", s.reason);

  // If AI fell through, top up with more rotating categories so we still hit 5.
  for (const cat of cats) push(cat, "suggestion");

  return out.slice(0, 5);
}

export { todayKey };