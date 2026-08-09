"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Pencil, Plus, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  deleteBook,
  listBooks,
  updateBookMeta,
  type BookRow,
} from "@/app/(app)/library/actions";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<BookRow["status"], string> = {
  unread: "Unread",
  reading: "Reading",
  finished: "Finished",
};

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function progressPercent(b: BookRow) {
  if (b.progress > 0) return Math.round(b.progress * 100);
  if (b.format === "pdf" && b.totalPages) {
    return Math.round((b.currentPage / b.totalPages) * 100);
  }
  return null;
}

export function LibraryApp() {
  const [books, setBooks] = useState<BookRow[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBooks(await listBooks());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Library</h1>
          <p className="text-sm text-muted-foreground">
            Your books, read right here.
          </p>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Plus />
          Add book
        </Button>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {books.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <BookOpen className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No books yet</p>
            <p className="text-sm text-muted-foreground">
              Upload a PDF or EPUB to start reading in-app.
            </p>
            <Button className="mt-2" onClick={() => setUploadOpen(true)}>
              <Upload />
              Upload a book
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((b) => (
            <li key={b.id}>
              <BookCard book={b} onChanged={load} />
            </li>
          ))}
        </ul>
      )}

      {uploadOpen && (
        <UploadDialog
          onClose={() => setUploadOpen(false)}
          onAdded={async () => {
            setUploadOpen(false);
            await load();
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

function BookCard({
  book,
  onChanged,
}: {
  book: BookRow;
  onChanged: () => Promise<void>;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const pct = progressPercent(book);

  return (
    <Card className="h-full">
      <CardContent className="flex flex-col gap-2">
        <Link href={`/library/${book.id}`} className="group flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-md border bg-muted/50">
            <BookOpen className="size-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium group-hover:underline">
              {book.title}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {book.author || "Unknown author"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground/70 uppercase">
              {book.format} · {formatSize(book.fileSize)}
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              book.status === "reading" &&
                "bg-primary/10 text-primary",
              book.status === "finished" && "bg-emerald-500/10 text-emerald-600",
              book.status === "unread" && "bg-muted text-muted-foreground",
            )}
          >
            {STATUS_LABEL[book.status]}
          </span>
          {pct !== null && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {pct}%
            </span>
          )}
        </div>

        {book.progress > 0 && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.round(book.progress * 100)}%` }}
            />
          </div>
        )}

        <div className="flex items-center justify-between">
          <Button
            render={<Link href={`/library/${book.id}`} />}
            nativeButton={false}
            size="sm"
            variant="outline"
            className="gap-1"
          >
            <BookOpen className="size-3.5" />
            Open
          </Button>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditOpen(true)}
              aria-label="Edit book"
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                void (async () => {
                  await deleteBook(book.id);
                  await onChanged();
                })();
              }}
              aria-label="Delete book"
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      </CardContent>

      {editOpen && (
        <EditDialog
          book={book}
          onClose={() => setEditOpen(false)}
          onSaved={onChanged}
        />
      )}
    </Card>
  );
}

function EditDialog({
  book,
  onClose,
  onSaved,
}: {
  book: BookRow;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author ?? "");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit book</DialogTitle>
          <DialogDescription>Update title or author.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              await updateBookMeta(book.id, { title, author });
              await onSaved();
              onClose();
            })();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-author">Author (optional)</Label>
            <Input
              id="edit-author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UploadDialog({
  onClose,
  onAdded,
  onError,
}: {
  onClose: () => void;
  onAdded: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const canSubmit = title.trim() && file;

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a book</DialogTitle>
          <DialogDescription>
            PDF or EPUB, up to 50MB. Author is optional — fill it in later.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit || busy) return;
            void (async () => {
              setBusy(true);
              onError("");
              const form = new FormData();
              form.set("title", title);
              form.set("author", author);
              form.set("file", file);
              const res = await fetch("/api/library/upload", {
                method: "POST",
                body: form,
              });
              if (!res.ok) {
                const data = (await res.json().catch(() => null)) as {
                  error?: string;
                } | null;
                onError(data?.error ?? "Upload failed.");
                setBusy(false);
                return;
              }
              const { id } = (await res.json()) as { id: string };
              setBusy(false);
              router.push(`/library/${id}`);
              await onAdded();
            })();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="book-title">Title</Label>
            <Input
              id="book-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="book-author">Author (optional)</Label>
            <Input
              id="book-author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="book-file">File</Label>
            <Input
              id="book-file"
              type="file"
              accept=".pdf,.epub,application/pdf,application/epub+zip"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} · {formatSize(file.size)}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || busy}>
              {busy ? "Uploading…" : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
