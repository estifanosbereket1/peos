"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Soft cap on a single recording (~12 min) to keep stored files reasonable. */
export const MAX_RECORDING_MS = 12 * 60 * 1000;

function pickMime(): string {
  if (typeof window !== "undefined" && typeof MediaRecorder !== "undefined") {
    if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus"))
      return "audio/webm;codecs=opus";
    if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
    if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  }
  return "audio/webm";
}

export type RecorderResult = {
  mime: string;
  durationSeconds: number;
  /** Local object URL for preview; revoked via `clear`. */
  previewUrl: string;
  /** The raw audio Blob — post this to the voice API routes. */
  blob: Blob;
};

export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [result, setResult] = useState<RecorderResult | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const mimeRef = useRef<string>("audio/webm");
  const chunksRef = useRef<BlobPart[]>([]);
  const capTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (capTimerRef.current) clearTimeout(capTimerRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      recorderRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    if (capTimerRef.current) clearTimeout(capTimerRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    if (!recorderRef.current) return;
    setRecording(false);
    setElapsedSeconds(0);
    recorderRef.current.stop();
  }, []);

  const start = useCallback(async () => {
    setMicError(null);
    setResult(null);
    setElapsedSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mimeRef.current = pickMime();
      const recorder = new MediaRecorder(stream, {
        ...(mimeRef.current.startsWith("audio/mp4") ? {} : { mimeType: mimeRef.current }),
      });
      const chunks: BlobPart[] = [];
      chunksRef.current = chunks;
      const startedAt = Date.now();
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const durationMs = Date.now() - startedAt;
        const blob = new Blob(chunks, { type: mimeRef.current });
        stream.getTracks().forEach((t) => t.stop());
        setResult((prev) => {
          if (prev) URL.revokeObjectURL(prev.previewUrl);
          return {
            mime: blob.type || "audio/webm",
            durationSeconds: Math.max(1, Math.round(durationMs / 1000)),
            blob,
            previewUrl: URL.createObjectURL(blob),
          };
        });
      };
      recorder.start(200);
      setRecording(true);
      tickRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
      }, 1000);
      capTimerRef.current = setTimeout(stop, MAX_RECORDING_MS);
    } catch {
      setMicError("Microphone access — check permission.");
      setRecording(false);
    }
  }, [stop]);

  const clear = useCallback(() => {
    setResult((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }, []);

  return { recording, start, stop, micError, result, clear, elapsedSeconds };
}