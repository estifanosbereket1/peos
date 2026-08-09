"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Mic, Square, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { aiConfigured } from "@/app/(app)/voice/actions";
import { useRecorder, type RecorderResult } from "./use-recorder";

export type PendingClip = {
  mime: string;
  durationSeconds: number;
  blob: Blob;
};

function formatClock(s: number): string {
  const m = Math.floor(s / 60);
  const sec = String(s % 60).padStart(2, "0");
  return `${m}:${sec}`;
}

/**
 * Record a voice clip for a form field. Unlike the old auto-transcribe button,
 * recording ONLY captures audio (no server call). The parent holds the clip
 * (onClipChange) and uploads it together with the entry on save. Transcription
 * is an explicit, separate action via onTranscribe. Works without an AI key —
 * only the Transcribe button is hidden then.
 */
export function VoiceClipButton({
  onClipChange,
  onTranscribe,
}: {
  onClipChange: (clip: PendingClip | null) => void;
  onTranscribe?: (text: string) => void;
}) {
  const [configured, setConfigured] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorder = useRecorder();

  useEffect(() => {
    let alive = true;
    void aiConfigured().then((ok) => {
      if (alive) setConfigured(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Report the pending clip whenever a recording lands.
  useEffect(() => {
    if (recorder.result) {
      onClipChange({
        mime: recorder.result.mime,
        durationSeconds: recorder.result.durationSeconds,
        blob: recorder.result.blob,
      });
    }
  }, [recorder.result, onClipChange]);

  const transcribe = useCallback(
    async (result: RecorderResult) => {
      if (!onTranscribe || transcribing) return;
      setTranscribing(true);
      try {
        const form = new FormData();
        form.append("file", result.blob, "voice.webm");
        const res = await fetch("/api/voice/transcribe", { method: "POST", body: form });
        const data = (await res.json()) as { text?: string | null };
        if (data.text) onTranscribe(data.text);
      } finally {
        setTranscribing(false);
      }
    },
    [onTranscribe, transcribing],
  );

  const clear = () => {
    recorder.clear();
    onClipChange(null);
  };

  // Recording in progress → red pill with a stop button.
  if (recorder.recording) {
    return (
      <div className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
        <span className="flex items-center gap-1 font-medium">
          <span className="size-2 animate-pulse rounded-full bg-destructive" />
          Recording
        </span>
        <span className="tabular-nums">{formatClock(recorder.elapsedSeconds)}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-5 p-0 text-destructive"
          onClick={recorder.stop}
          aria-label="Stop recording"
        >
          <Square className="size-3.5" />
        </Button>
      </div>
    );
  }

  // A clip was just recorded → preview + optional transcribe + remove.
  if (recorder.result) {
    return (
      <div className="flex flex-col gap-1.5 rounded-md border bg-muted/30 px-2 py-1.5">
        <div className="flex items-center gap-2">
          <audio
            controls
            src={recorder.result.previewUrl}
            className="h-8 min-w-0 flex-1"
          />
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {formatClock(recorder.result.durationSeconds)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 shrink-0"
            onClick={clear}
            aria-label="Discard recording"
          >
            <X className="size-3.5" />
          </Button>
        </div>
        {configured && onTranscribe && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="self-start"
            disabled={transcribing}
            onClick={() => void transcribe(recorder.result!)}
          >
            {transcribing ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Transcribing…
              </>
            ) : (
              "Transcribe to text"
            )}
          </Button>
        )}
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-7 shrink-0"
      onClick={() => void recorder.start()}
      aria-label="Record voice"
      title="Record a voice clip"
    >
      <Mic className="size-4" />
    </Button>
  );
}
