"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  GraduationCap,
  Maximize2,
  Minimize,
  Pencil,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

import { createLog } from "@/app/(app)/learn/actions";
import { addProof } from "@/app/(app)/proof/actions";
import {
  addBookNote,
  deleteBookNote,
  listBookNotes,
  markOpened,
  savePosition,
  setBookStatus,
  updateBookNote,
  type BookNoteRow,
  type BookRow,
} from "@/app/(app)/library/actions";
import { EpubReader } from "@/components/library/epub-reader";
import { PdfReader } from "@/components/library/pdf-reader";
import { todayKey } from "@/lib/time";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<BookRow["status"], string> = {
  unread: "Unread",
  reading: "Reading",
  finished: "Finished",
};

export function ReaderApp({ book }: { book: BookRow }) {
  const [notes, setNotes] = useState<BookNoteRow[]>([]);
  const [status, setStatus] = useState<BookRow["status"]>(book.status);
  const [logOpen, setLogOpen] = useState(false);
  const [proofOpen, setProofOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readerCardRef = useRef<HTMLDivElement | null>(null);

  const loadNotes = useCallback(async () => {
    setNotes(await listBookNotes(book.id));
  }, [book.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNotes();
    void markOpened(book.id);
  }, [loadNotes, book.id]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  useEffect(() => {
    const sync = () => {
      const doc = document as Document & {
        webkitFullscreenElement?: Element | null;
      };
      setIsFullscreen(
        Boolean(document.fullscreenElement ?? doc.webkitFullscreenElement),
      );
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    sync();
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = readerCardRef.current;
    if (!el) return;
    try {
      const doc = document as Document & {
        webkitExitFullscreen?: () => void;
        webkitFullscreenElement?: Element | null;
      };
      if (document.fullscreenElement ?? doc.webkitFullscreenElement) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else doc.webkitExitFullscreen?.();
      } else {
        const anyEl = el as HTMLElement & {
          webkitRequestFullscreen?: () => Promise<void> | void;
        };
        if (anyEl.requestFullscreen) await anyEl.requestFullscreen();
        else if (anyEl.webkitRequestFullscreen) await anyEl.webkitRequestFullscreen();
      }
    } catch {
      toast.error("Fullscreen isn't supported here.");
    }
  }, []);

  const debouncePosition = useCallback(
    (patch: { page?: number; location?: string; progress?: number }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void savePosition(book.id, patch);
      }, 600);
    },
    [book.id],
  );

  const onPdfNavigate = useCallback(
    (page: number) => {
      debouncePosition({ page });
    },
    [debouncePosition],
  );

  const onEpubNavigate = useCallback(
    (location: string, progress: number) => {
      debouncePosition({ location, progress });
    },
    [debouncePosition],
  );

  const onTotalPages = useCallback(
    (pages: number) => {
      void savePosition(book.id, { totalPages: pages });
    },
    [book.id],
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          href="/library"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Library
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-md border bg-muted/50">
            <BookOpen className="size-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{book.title}</h1>
            <p className="text-sm text-muted-foreground">
              {book.author || "Unknown author"} · {book.format.toUpperCase()}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  status === "reading" && "bg-primary/10 text-primary",
                  status === "finished" && "bg-emerald-500/10 text-emerald-600",
                  status === "unread" && "bg-muted text-muted-foreground",
                )}
              >
                {STATUS_LABEL[status]}
              </span>
              {status !== "finished" && (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    void setBookStatus(book.id, "finished");
                    setStatus("finished");
                  }}
                >
                  <CheckCircle2 />
                  Mark finished
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void toggleFullscreen()}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <Minimize /> : <Maximize2 />}
            {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLogOpen(true)}>
            <GraduationCap />
            Log as learning
          </Button>
          <Button variant="outline" size="sm" onClick={() => setProofOpen(true)}>
            <ShieldCheck />
            Save as proof
          </Button>
        </div>
      </div>

      <Card
        ref={readerCardRef}
        className="fullscreen:fixed fullscreen:inset-0 fullscreen:z-50 fullscreen:overflow-auto fullscreen:rounded-none fullscreen:border-0"
      >
        <CardContent className="pt-6 fullscreen:flex fullscreen:flex-1 fullscreen:flex-col">
          {book.format === "pdf" ? (
            <PdfReader
              url={book.fileUrl}
              initialPage={book.currentPage}
              onTotalPages={onTotalPages}
              onNavigate={onPdfNavigate}
              fullscreen={isFullscreen}
            />
          ) : (
            <EpubReader
              url={book.fileUrl}
              initialLocation={book.currentLocation}
              onNavigate={onEpubNavigate}
              fullscreen={isFullscreen}
            />
          )}
        </CardContent>
      </Card>

      <NotesPanel
        notes={notes}
        currentPage={book.currentPage}
        format={book.format}
        onAdd={async (content, page) => {
          await addBookNote(book.id, content, page);
          await loadNotes();
        }}
        onUpdate={async (id, content, page) => {
          await updateBookNote(id, book.id, content, page);
          await loadNotes();
        }}
        onDelete={async (id) => {
          await deleteBookNote(id, book.id);
          await loadNotes();
        }}
      />

      {logOpen && (
        <LearningDialog
          book={book}
          onClose={() => setLogOpen(false)}
        />
      )}
      {proofOpen && (
        <ProofDialog
          book={book}
          onClose={() => setProofOpen(false)}
        />
      )}
    </div>
  );
}

function NotesPanel({
  notes,
  currentPage,
  format,
  onAdd,
  onUpdate,
  onDelete,
}: {
  notes: BookNoteRow[];
  currentPage: number;
  format: "pdf" | "epub";
  onAdd: (content: string, page?: number | null) => Promise<void>;
  onUpdate: (id: string, content: string, page?: number | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [content, setContent] = useState("");
  const [page, setPage] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes &amp; highlights</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const c = content.trim();
            if (!c) return;
            const p = page.trim() ? Number(page) : null;
            if (editingId) {
              void onUpdate(editingId, c, p);
              setEditingId(null);
            } else {
              void onAdd(c, p);
            }
            setContent("");
            setPage("");
          }}
        >
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              editingId
                ? "Edit note…"
                : "A thought, a quote, something worth keeping…"
            }
            rows={2}
          />
          <div className="flex flex-wrap items-center gap-2">
            {format === "pdf" ? (
              <div className="flex items-center gap-1.5">
                <Label htmlFor="note-page" className="text-xs text-muted-foreground">
                  Page
                </Label>
                <Input
                  id="note-page"
                  type="number"
                  min={1}
                  className="h-7 w-20"
                  value={page}
                  onChange={(e) => setPage(e.target.value)}
                  placeholder={String(currentPage || 1)}
                />
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">
                EPUB notes aren&apos;t tied to a page number.
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              {editingId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingId(null);
                    setContent("");
                    setPage("");
                  }}
                >
                  Cancel
                </Button>
              )}
              <Button type="submit" size="sm" disabled={!content.trim()}>
                {editingId ? "Save note" : "Add note"}
              </Button>
            </div>
          </div>
        </form>

        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No notes yet. Jot down what stands out.
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {notes.map((n) => (
              <li key={n.id} className="group flex items-start gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  {n.page ? (
                    <p className="text-xs text-muted-foreground">Page {n.page}</p>
                  ) : null}
                  <p className="whitespace-pre-wrap text-sm">{n.content}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground/70 tabular-nums">
                    {n.createdAt.toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => {
                      setEditingId(n.id);
                      setContent(n.content);
                      setPage(n.page ? String(n.page) : "");
                    }}
                    aria-label="Edit note"
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => void onDelete(n.id)}
                    aria-label="Delete note"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function LearningDialog({
  book,
  onClose,
}: {
  book: BookRow;
  onClose: () => void;
}) {
  const [topic, setTopic] = useState(book.title);
  const [content, setContent] = useState(
    `Reading: ${book.title}${book.author ? ` by ${book.author}` : ""}\n`,
  );
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log as a learning entry</DialogTitle>
          <DialogDescription>
            The book is pre-filled as the topic. Write what you actually
            learned.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!topic.trim() || busy) return;
            void (async () => {
              setBusy(true);
              await createLog(todayKey(), topic, content, "user");
              setBusy(false);
              toast.success("Logged to Learning Log");
              onClose();
            })();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="log-topic">Topic</Label>
            <Input
              id="log-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="log-content">What did you learn?</Label>
            <Textarea
              id="log-content"
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={!topic.trim() || busy}>
              {busy ? "Saving…" : "Save entry"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProofDialog({
  book,
  onClose,
}: {
  book: BookRow;
  onClose: () => void;
}) {
  const [content, setContent] = useState(
    `Read ${book.title}${book.author ? ` by ${book.author}` : ""}.`,
  );
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save as proof</DialogTitle>
          <DialogDescription>
            A proof entry referencing the book. Confirm or edit before saving.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const c = content.trim();
            if (!c || busy) return;
            void (async () => {
              setBusy(true);
              await addProof(c, "manual");
              setBusy(false);
              toast.success("Saved to Proof Log");
              onClose();
            })();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="proof-content">Proof entry</Label>
            <Textarea
              id="proof-content"
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={!content.trim() || busy}>
              {busy ? "Saving…" : "Save proof"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
