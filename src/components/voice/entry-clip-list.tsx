"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  deleteEntryClip,
  listEntryClips,
  transcribeEntryClipNow,
  type EntryClipRow,
} from "@/app/(app)/voice/actions";

/**
 * Renders voice clips already saved on a list of entries (learn/proof/review).
 * Shows a play button per clip; if the clip has no transcript yet and AI is
 * configured, an explicit "Transcribe" button runs transcription on demand.
 * A remove button lets the user detach a clip.
 */
export function EntryClipList({
  ownerKind,
  ownerIds,
  fields,
  aiReady,
  onChanged,
}: {
  ownerKind: "learn" | "proof" | "review";
  ownerIds: string[];
  fields?: string[];
  aiReady: boolean;
  onChanged?: () => Promise<void>;
}) {
  const [clips, setClips] = useState<EntryClipRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setClips(await listEntryClips(ownerKind, ownerIds));
  }, [ownerKind, ownerIds]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const visible = fields
    ? clips.filter((c) => fields.includes(c.field))
    : clips;
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {visible.map((c) => (
        <div key={c.id} className="flex items-center gap-2">
          <audio controls src={c.audioUrl} className="h-8 min-w-0 flex-1" />
          {c.transcriptStatus === "done" && c.transcript ? (
            <span className="text-xs text-muted-foreground">transcribed</span>
          ) : aiReady ? (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              disabled={busyId === c.id}
              onClick={() => {
                void (async () => {
                  setBusyId(c.id);
                  await transcribeEntryClipNow(c.id);
                  setBusyId(null);
                  await load();
                  await onChanged?.();
                })();
              }}
            >
              {busyId === c.id ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                "Transcribe"
              )}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0"
            aria-label="Remove clip"
            onClick={() => {
              void (async () => {
                await deleteEntryClip(c.id);
                await load();
                await onChanged?.();
              })();
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}
