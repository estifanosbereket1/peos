"use server";

import { and, desc, eq, ilike, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { nightReviews } from "@/db/schema";
import { callGroq, isGroqConfigured } from "@/lib/ai/groq";
import { requireSession } from "@/lib/session";
import { todayKey } from "@/lib/time";

function validDayKey(key: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(key);
}

export async function getReview(dayKey: string = todayKey()) {
  const session = await requireSession();
  if (!validDayKey(dayKey)) return null;
  const rows = await db
    .select()
    .from(nightReviews)
    .where(
      and(
        eq(nightReviews.userId, session.user.id),
        eq(nightReviews.dayKey, dayKey),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export type SaveReviewInput = {
  dayKey: string;
  wins?: string | null;
  improve?: string | null;
  nextMove?: string | null;
  energy?: number | null;
};

export async function saveReview(input: SaveReviewInput): Promise<string | null> {
  const session = await requireSession();
  if (!validDayKey(input.dayKey)) return null;
  const energy =
    input.energy == null
      ? null
      : Math.min(5, Math.max(1, Math.round(input.energy)));
  const [row] = await db
    .insert(nightReviews)
    .values({
      userId: session.user.id,
      dayKey: input.dayKey,
      wins: input.wins?.trim() || null,
      improve: input.improve?.trim() || null,
      nextMove: input.nextMove?.trim() || null,
      energy,
    })
    .onConflictDoUpdate({
      target: [nightReviews.userId, nightReviews.dayKey],
      set: {
        wins: input.wins?.trim() || null,
        improve: input.improve?.trim() || null,
        nextMove: input.nextMove?.trim() || null,
        energy,
        updatedAt: new Date(),
      },
    })
    .returning({ id: nightReviews.id });
  revalidatePath("/review");
  return row?.id ?? null;
}

export async function listReviews(limit = 60) {
  const session = await requireSession();
  return db
    .select()
    .from(nightReviews)
    .where(eq(nightReviews.userId, session.user.id))
    .orderBy(desc(nightReviews.dayKey))
    .limit(limit);
}

export async function searchReviews(query?: string, limit = 30) {
  const session = await requireSession();
  const q = query?.trim();
  const base = eq(nightReviews.userId, session.user.id);
  const rows = await db
    .select()
    .from(nightReviews)
    .where(
      q
        ? and(
            base,
            or(
              ilike(nightReviews.wins, `%${q}%`),
              ilike(nightReviews.improve, `%${q}%`),
              ilike(nightReviews.nextMove, `%${q}%`),
            ),
          )
        : base,
    )
    .orderBy(desc(nightReviews.dayKey))
    .limit(limit);
  return rows;
}

// ---------- AI pattern-spotter ----------

export async function aiConfigured(): Promise<boolean> {
  return isGroqConfigured();
}

export type ReviewPattern = { pattern: string; evidence: string };

const PATTERN_SYSTEM_PROMPT = `You are a dispassionate pattern-spotter for someone's nightly reviews.

Given their last ~30 night-review entries (energy rating 1-5, what went well, what could be better, next-day intention), identify 2-4 concrete recurring patterns.

Rules:
- Patterns must be specific and supported by the data — e.g. correlation between energy rating and a recurring drain, a repeating win, or a repeating frustration.
- No vague generalities. Each must reference actual recurring content (quote-ish brief pointers, e.g. "appears in most high-energy days").
- Output STRICT JSON: {"patterns":[{"pattern":"...","evidence":"..."}]}.
- No preamble, no markdown, no free text outside the JSON.`;

/** Ask Groq for recurring patterns. Returns [] on failure or <7 reviews. */
export async function findReviewPatterns(): Promise<ReviewPattern[]> {
  if (!isGroqConfigured()) return [];
  const session = await requireSession();

  const rows = await db
    .select({
      dayKey: nightReviews.dayKey,
      energy: nightReviews.energy,
      wins: nightReviews.wins,
      improve: nightReviews.improve,
      nextMove: nightReviews.nextMove,
    })
    .from(nightReviews)
    .where(eq(nightReviews.userId, session.user.id))
    .orderBy(desc(nightReviews.dayKey))
    .limit(30);

  if (rows.length < 7) return [];

  const text = rows
    .map(
      (r) =>
        `[${r.dayKey}] energy=${r.energy ?? "—"} | went well: ${r.wins?.trim() || "—"} | could be better: ${r.improve?.trim() || "—"} | next: ${r.nextMove?.trim() || "—"}`,
    )
    .join("\n");

  const res = await callGroq<{ patterns?: ReviewPattern[] }>(
    PATTERN_SYSTEM_PROMPT,
    `Night reviews (newest first):\n${text}`,
    true,
  );
  const list = (res as { patterns?: ReviewPattern[] } | null)?.patterns;
  if (!Array.isArray(list)) return [];
  return list
    .filter(
      (p) =>
        p &&
        typeof p.pattern === "string" &&
        p.pattern.trim() &&
        typeof p.evidence === "string" &&
        p.evidence.trim(),
    )
    .slice(0, 4)
    .map((p) => ({
      pattern: p.pattern.trim(),
      evidence: p.evidence.trim(),
    }));
}