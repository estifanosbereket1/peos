"use server";

import { and, desc, eq, ilike } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { proofEntries } from "@/db/schema";
import { requireSession } from "@/lib/session";

type ProofRow = {
  id: string;
  text: string;
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

export async function addProof(text: string, source: "manual" | "auto" = "manual") {
  const session = await requireSession();
  const t = text.trim();
  if (!t) return;
  await db.insert(proofEntries).values({
    userId: session.user.id,
    text: t,
    source,
  });
  revalidatePath("/proof");
  revalidatePath("/"); // today's proof stat
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
    .where(eq(proofEntries.userId, session.user.id));
  if (rows.length === 0) return null;
  return rows[Math.floor(Math.random() * rows.length)].text;
}