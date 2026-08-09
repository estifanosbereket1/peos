"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RelocatedEvent = {
  start?: { cfi?: string };
};

type EpubRendition = {
  display: (target?: string) => Promise<void>;
  on: (event: "relocated", cb: (loc: RelocatedEvent) => void) => void;
  prev: () => void;
  next: () => void;
  resize: (width: number, height: number) => void;
  destroy: () => void;
};

type EpubBook = {
  ready: Promise<unknown>;
  renderTo: (el: HTMLElement, opts: object) => EpubRendition;
  locations: { percentageFromCfi: (cfi: string) => number };
  destroy?: () => void;
};

export function EpubReader({
  url,
  initialLocation,
  onNavigate,
  fullscreen = false,
}: {
  url: string;
  initialLocation?: string | null;
  onNavigate?: (location: string, progress: number) => void;
  fullscreen?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<EpubRendition | null>(null);
  const bookRef = useRef<EpubBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let alive = true;
    let book: EpubBook | null = null;
    let rendition: EpubRendition | null = null;

    async function init() {
      try {
        const ePub = (await import("epubjs")).default;
        if (!alive || !hostRef.current) return;
        // Our file URL has no ".epub" extension, so epub.js would otherwise
        // treat it as a directory of files. openAs:"epub" makes it fetch the
        // whole file as binary and unzip it client-side.
        book = ePub(url, { openAs: "epub" }) as EpubBook;
        bookRef.current = book;
        rendition = book.renderTo(hostRef.current, {
          width: "100%",
          height: "100%",
          flow: "paginated",
          spread: "none",
        });
        renditionRef.current = rendition;
        await book.ready;

        rendition.on("relocated", (location) => {
          if (!alive) return;
          const start = location?.start?.cfi;
          if (typeof start === "string") {
            let p = 0;
            try {
              p = bookRef.current?.locations.percentageFromCfi(start) ?? 0;
            } catch {
              p = 0;
            }
            setProgress(p);
            onNavigate?.(start, p);
          }
        });

        if (initialLocation) {
          await rendition.display(initialLocation);
        } else {
          await rendition.display();
        }
        if (alive) setLoading(false);
      } catch {
        if (alive) {
          setError("Could not open this EPUB.");
          setLoading(false);
        }
      }
    }

    void init();
    return () => {
      alive = false;
      try {
        rendition?.destroy();
        book?.destroy?.();
      } catch {
        // already torn down
      }
      renditionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      renditionRef.current?.resize(el.clientWidth, el.clientHeight);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={hostRef}
        className={cn(
          "overflow-hidden rounded-lg border bg-background",
          fullscreen ? "min-h-[calc(100vh-12rem)]" : "min-h-[65vh]",
        )}
        style={{ height: fullscreen ? "calc(100vh - 12rem)" : "65vh" }}
      />
      {loading ? (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading EPUB…
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void renditionRef.current?.prev()}
            aria-label="Previous page"
          >
            <ChevronLeft />
            Prev
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {Math.round(progress * 100)}%
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void renditionRef.current?.next()}
            aria-label="Next page"
          >
            Next
            <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  );
}
