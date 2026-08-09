"use server";

import { and, desc, eq, gte, ilike, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { growthSummaries, nightReviews, proofEntries } from "@/db/schema";
import { callGroq, isGroqConfigured } from "@/lib/ai/groq";
import { requireSession } from "@/lib/session";
import { shiftDayKey, todayKey } from "@/lib/time";

export type ProofRow = {
  id: string;
  text: string | null;
  source: "manual" | "auto";
  createdAt: Date;
};

function toRow(row: typeof proofEntries.$inferSelect): ProofRow {
  return {
    id: row.id,
    text: row.text,
    source: row.source,
    createdAt: row.createdAt,
  };
}

export async function getProof(limit = 100): Promise<ProofRow[]> {
  const session = await requireSession();
  const rows = await db
    .select()
    .from(proofEntries)
    .where(eq(proofEntries.userId, session.user.id))
    .orderBy(desc(proofEntries.createdAt))
    .limit(limit);
  return rows.map(toRow);
}

export async function searchProof(query?: string): Promise<ProofRow[]> {
  const session = await requireSession();
  const q = query?.trim();
  const rows = await db
    .select()
    .from(proofEntries)
    .where(
      q
        ? and(
            eq(proofEntries.userId, session.user.id),
            ilike(proofEntries.text, `%${q}%`),
          )
        : eq(proofEntries.userId, session.user.id),
    )
    .orderBy(desc(proofEntries.createdAt))
    .limit(100);
  return rows.map(toRow);
}

export async function addProof(
  text: string,
  source: "manual" | "auto" = "manual",
): Promise<string | null> {
  const session = await requireSession();
  const t = text.trim();
  const [created] = await db
    .insert(proofEntries)
    .values({
      userId: session.user.id,
      text: t || null,
      source,
    })
    .returning({ id: proofEntries.id });
  revalidatePath("/proof");
  revalidatePath("/"); // today's proof stat
  return created?.id ?? null;
}

export async function addProofFromReview(text: string) {
  const t = text?.trim();
  if (!t) return;
  const session = await requireSession();
  await db.insert(proofEntries).values({
    userId: session.user.id,
    text: t,
    source: "auto",
  });
  revalidatePath("/proof");
}

export async function deleteProof(id: string) {
  const session = await requireSession();
  await db
    .delete(proofEntries)
    .where(and(eq(proofEntries.id, id), eq(proofEntries.userId, session.user.id)));
  revalidatePath("/proof");
}

/** Count of proof entries kept. */
export async function getProofCount(): Promise<number> {
  const session = await requireSession();
  const rows = await db
    .select({ id: proofEntries.id })
    .from(proofEntries)
    .where(eq(proofEntries.userId, session.user.id));
  return rows.length;
}

/** A random past proof entry (quiet "remember:" reminder). */
export async function getRandomProof(): Promise<string | null> {
  const session = await requireSession();
  const rows = await db
    .select({ id: proofEntries.id, text: proofEntries.text })
    .from(proofEntries)
    .where(and(eq(proofEntries.userId, session.user.id)));
  const withText = rows.filter((r) => r.text?.trim());
  if (withText.length === 0) return null;
  return withText[Math.floor(Math.random() * withText.length)].text;
}

// ---------- AI summarizer ----------

export async function aiConfigured(): Promise<boolean> {
  return isGroqConfigured();
}

export type GrowthSummaryRow = {
  id: string;
  content: string;
  createdAt: Date;
};

const SUMMARY_SYSTEM_PROMPT = `You are a calm, evidence-based reviewer of a person's growth journal.

Given their proof log entries (things that actually happened) and recent night-review "wins", write a short growth summary.

Rules:
- Honest and specific. No motivational filler, no hype, no generic affirmations.
- Name concrete patterns: what they shipped or finished, where they shifted from confused to confident, what keeps repeating.
- 2-3 short paragraphs maximum.
- Write as plain text. No markdown headers, no lists with asterisks, no greeting/signoff.`;

/** Ask Groq to summarize the user's growth. Returns null on failure / too little data. */
export async function summarizeGrowth(): Promise<{ text: string } | null> {
  if (!isGroqConfigured()) return null;
  const session = await requireSession();

  const [proof, reviews] = await Promise.all([
    db
      .select({ text: proofEntries.text, createdAt: proofEntries.createdAt })
      .from(proofEntries)
      .where(eq(proofEntries.userId, session.user.id))
      .orderBy(desc(proofEntries.createdAt))
      .limit(40),
    db
      .select({ wins: nightReviews.wins, dayKey: nightReviews.dayKey })
      .from(nightReviews)
      .where(
        and(
          eq(nightReviews.userId, session.user.id),
          gte(nightReviews.dayKey, shiftDayKey(todayKey(), -30)),
          lte(nightReviews.dayKey, todayKey()),
        ),
      )
      .orderBy(desc(nightReviews.dayKey))
      .limit(40),
  ]);

  if (proof.length < 3 && reviews.filter((r) => r.wins?.trim()).length < 3) {
    return null;
  }

  const proofText = proof
    .filter((p) => p.text?.trim())
    .slice(0, 40)
    .map((p) => `- ${p.text}`)
    .join("\n");
  const winsText =
    reviews
      .filter((r) => r.wins?.trim())
      .slice(0, 40)
      .map((r) => `- [${r.dayKey}] ${r.wins}`)
      .join("\n") || "(no recent wins logged)";

  const text = await callGroq(
    SUMMARY_SYSTEM_PROMPT,
    `Proof log entries (newest first):\n${proofText}\n\nRecent night-review wins:\n${winsText}`,
  );
  if (typeof text !== "string" || !text.trim()) return null;
  return { text };
}

export async function saveGrowthSummary(content: string) {
  const session = await requireSession();
  const c = content?.trim();
  if (!c) return;
  await db.insert(growthSummaries).values({
    userId: session.user.id,
    content: c,
  });
  revalidatePath("/proof");
}

export async function listGrowthSummaries(limit = 20): Promise<GrowthSummaryRow[]> {
  const session = await requireSession();
  const rows = await db
    .select()
    .from(growthSummaries)
    .where(eq(growthSummaries.userId, session.user.id))
    .orderBy(desc(growthSummaries.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    createdAt: r.createdAt,
  }));
}