import { todayKey } from "@/lib/time";

/**
 * Learning topic suggestions for a day.
 *
 * Sources: the user's own `learning_topics` pool + a fixed set of broad dev
 * categories that rotate deterministically with the date. AI-suggested topics
 * are stubbed out for now — `aiSuggest` intentionally returns [] so the `ai`
 * source column exists but never produces results yet.
 */

type Suggestion = { topic: string; source: "suggestion" | "user" | "ai" };

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

/** Placeholder for a future AI provider. Returns nothing for now. */
async function aiSuggestAsync(): Promise<string[]> {
  return [];
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
): Promise<Suggestion[]> {
  const [cats, ai] = await Promise.all([
    Promise.resolve(rotatingCategoriesFor(dayKey)),
    aiSuggestAsync(),
  ]);

  const seen = new Set<string>();
  const out: Suggestion[] = [];

  const push = (topic: string, source: Suggestion["source"]) => {
    const t = topic.trim();
    if (!t || seen.has(t.toLowerCase())) return;
    seen.add(t.toLowerCase());
    out.push({ topic: t, source });
  };

  // User-maintained pool first → most relevant.
  for (const topic of userTopics) push(topic, "user");
  for (const cat of cats) push(cat, "suggestion");
  for (const topic of ai) push(topic, "ai");

  return out.slice(0, 5);
}

export type { Suggestion };
export { todayKey };