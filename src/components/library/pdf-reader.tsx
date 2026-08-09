"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MAX_SCALE = 2.5;
const MIN_SCALE = 0.5;

export function PdfReader({
  url,
  initialPage,
  onTotalPages,
  onNavigate,
}: {
  url: string;
  initialPage: number;
  onTotalPages?: (pages: number) => void;
  onNavigate?: (page: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<Awaited<ReturnType<typeof loadPdf>> | null>(null);
  const [page, setPage] = useState(initialPage > 0 ? initialPage : 1);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [jump, setJump] = useState("");
  const renderTask = useRef<{ cancel: () => void } | null>(null);

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    loadPdf(url).then((d) => {
      if (!alive) return;
      setDoc(d);
      setNumPages(d.numPages);
      onTotalPages?.(d.numPages);
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
      const fitScale = Math.min(containerWidth / base.width, 1.6);
      const finalScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, fitScale));
      const viewport = pdfPage.getViewport({ scale: finalScale });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      renderTask.current?.cancel();
      const task = pdfPage.render({ canvas, viewport });
      renderTask.current = task;
      await task.promise;
    },
    [doc],
  );

  useEffect(() => {
    if (!doc) return;
    void renderPage(page);
  }, [doc, page, renderPage]);

  const goTo = useCallback(
    (n: number) => {
      if (!doc || n < 1 || n > doc.numPages) return;
      setPage(n);
      setJump(String(n));
      onNavigate?.(n);
    },
    [doc, onNavigate],
  );

  if (loading || !doc) {
    return (
      <div className="flex h-96 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading PDF…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={containerRef}
        className="flex min-h-[60vh] items-start justify-center overflow-auto rounded-lg border bg-muted/30 p-4"
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
