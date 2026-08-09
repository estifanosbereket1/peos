"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const MAX_SCALE = 2.5;
const MIN_SCALE = 0.5;

function isRenderCancel(err: unknown): boolean {
  return (
    !!err &&
    typeof err === "object" &&
    "name" in err &&
    (err as { name?: string }).name === "RenderingCancelledException"
  );
}

export function PdfReader({
  url,
  initialPage,
  onTotalPages,
  onNavigate,
  fullscreen = false,
}: {
  url: string;
  initialPage: number;
  onTotalPages?: (pages: number) => void;
  onNavigate?: (page: number) => void;
  fullscreen?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<Awaited<ReturnType<typeof loadPdf>> | null>(null);
  const [page, setPage] = useState(initialPage > 0 ? initialPage : 1);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jump, setJump] = useState("");
  const renderTask = useRef<{ cancel: () => void } | null>(null);
  const pageRef = useRef(page);
  const resizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    loadPdf(url)
      .then((d) => {
        if (!alive) return;
        setDoc(d);
        setNumPages(d.numPages);
        onTotalPages?.(d.numPages);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setError("Could not load this PDF.");
        setLoading(false);
      });
    return () => {
      alive = false;
      renderTask.current?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const renderPage = useCallback(
    async (n: number) => {
      if (!doc || !canvasRef.current || !containerRef.current) return;
      const pdfPage = await doc.getPage(n);
      const containerWidth = containerRef.current.clientWidth;
      const base = pdfPage.getViewport({ scale: 1 });
      const maxScale = fullscreen ? MAX_SCALE : 1.6;
      const fitScale = Math.min(containerWidth / base.width, maxScale);
      const finalScale = Math.max(MIN_SCALE, fitScale);
      const viewport = pdfPage.getViewport({ scale: finalScale });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      renderTask.current?.cancel();
      const task = pdfPage.render({ canvas, viewport });
      renderTask.current = task;
      try {
        await task.promise;
      } catch (err) {
        if (isRenderCancel(err)) return;
        console.error(err);
      }
    },
    [doc, fullscreen],
  );

  useEffect(() => {
    if (!doc) return;
    void renderPage(page);
  }, [doc, page, renderPage]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (resizeTimer.current) clearTimeout(resizeTimer.current);
      resizeTimer.current = setTimeout(() => {
        void renderPage(pageRef.current);
      }, 120);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (resizeTimer.current) clearTimeout(resizeTimer.current);
    };
  }, [renderPage]);

  const goTo = useCallback(
    (n: number) => {
      if (!doc || n < 1 || n > doc.numPages) return;
      setPage(n);
      setJump(String(n));
      onNavigate?.(n);
    },
    [doc, onNavigate],
  );

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (loading || !doc) {
    return (
      <div className="flex h-96 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading PDF…
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        fullscreen && "flex-1 min-h-0",
      )}
    >
      <div
        ref={containerRef}
        className={cn(
          "flex min-h-[60vh] flex-1 items-start justify-center overflow-auto rounded-lg border bg-muted/30 p-4",
          fullscreen && "min-h-0",
        )}
      >
        <canvas ref={canvasRef} className="max-w-full shadow-sm" />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => goTo(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft />
          Prev
        </Button>
        <div className="flex items-center gap-1.5 text-sm tabular-nums">
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(jump);
              if (Number.isFinite(n)) goTo(n);
            }}
          >
            <Input
              className="h-7 w-16 text-center"
              value={jump || String(page)}
              onChange={(e) => setJump(e.target.value)}
              aria-label="Go to page"
            />
            <span className="text-muted-foreground">/ {numPages}</span>
          </form>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= numPages}
          onClick={() => goTo(page + 1)}
          aria-label="Next page"
        >
          Next
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

async function loadPdf(url: string) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({ url });
  return task.promise;
}
