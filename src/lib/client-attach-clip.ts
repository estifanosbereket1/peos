"use client";

import type { PendingClip } from "@/components/voice/voice-clip";

/** Upload a pending clip to an existing entry's field. Returns true on success. */
export async function attachClip(
  ownerKind: "learn" | "proof" | "review",
  ownerId: string,
  field: string,
  clip: PendingClip,
): Promise<boolean> {
  const form = new FormData();
  form.append("ownerKind", ownerKind);
  form.append("ownerId", ownerId);
  form.append("field", field);
  form.append("file", clip.blob, "voice.webm");
  form.append("durationSeconds", String(clip.durationSeconds));
  const res = await fetch("/api/entry-voice", { method: "POST", body: form });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error || "Failed to save the clip.");
  }
  return true;
}
