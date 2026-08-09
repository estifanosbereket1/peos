"use client";

import { useCallback, useEffect, useState } from "react";
import { Mic, Pencil, Search, Square, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  createCategory,
  deleteCategory,
  deleteNote,
  listCategories,
  listNotes,
  searchNotes,
  transcribeNoteNow,
  updateNote,
  type VoiceNoteRow,
} from "@/app/(app)/voice/actions";
import { useRecorder, type RecorderResult } from "./use-recorder";

type Category = {
  id: string;
  name: string;
};

function formatDuration(s: number | null): string {
  if (!s) return "0:00";
  const m = Math.floor(s / 60);
  const sec = String(s % 60).padStart(2, "0");
  return `${m}:${sec}`;
}

export function VoiceApp({
  initialCategories,
  initialNotes,
  aiReady,
}: {
  initialCategories: Category[];
  initialNotes: VoiceNoteRow[];
  aiReady: boolean;
}) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [notes, setNotes] = useState<VoiceNoteRow[]>(initialNotes);
  const [categoryId, setCategoryId] = useState("");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  const [showCats, setShowCats] = useState(false);

  const recorder = useRecorder();

  const load = useCallback(async (q = query) => {
    setNotes(q.trim() ? await searchNotes(q) : await listNotes());
  }, [query]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const selectedName = categories.find((c) => c.id === categoryId)?.name;

  async function submit(result: RecorderResult) {
    if (saving) return;
    setSaving(true);
    try {
      const form = new FormData();
      form.append("file", result.blob, "voice.webm");
      if (categoryId) form.append("categoryId", categoryId);
      form.append("durationSeconds", String(result.durationSeconds));
      const res = await fetch("/api/voice/notes", { method: "POST", body: form });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Failed to save the note.");
      }
      recorder.clear();
      setCategoryId("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function transcribe(noteId: string) {
    if (transcribingId) return;
    setTranscribingId(noteId);
    try {
      await transcribeNoteNow(noteId);
      await load();
    } finally {
      setTranscribingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Voice note</CardTitle>
          <CardDescription>
            Records on-device, then saves the audio. Transcription (Amharic or
            English) only runs when you ask for it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
              <SelectTrigger className="w-56" aria-label="Category">
                <SelectValue placeholder="No category">{selectedName}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setShowCats(true)}>
              Categories
            </Button>
          </div>

          <div className="flex items-center gap-3">
            {!recorder.recording ? (
              <Button
                onClick={() => void recorder.start()}
                disabled={saving}
                className="gap-2"
              >
                <Mic className="size-4" />
                Record
              </Button>
            ) : (
              <Button onClick={recorder.stop} variant="destructive" className="gap-2">
                <Square className="size-4" />
                Stop
              </Button>
            )}
            {recorder.recording && (
              <span className="flex items-center gap-1.5 text-sm text-destructive">
                <span className="size-2 animate-pulse rounded-full bg-destructive" />
                <span className="tabular-nums font-medium">
                  {formatDuration(recorder.elapsedSeconds)}
                </span>
                recording · auto-stops at 12 min
              </span>
            )}
            {recorder.micError && (
              <span className="text-sm text-destructive">{recorder.micError}</span>
            )}
          </div>

          {recorder.result && (
            <div className="flex flex-col gap-2 rounded-md border bg-muted/30 px-3 py-2.5">
              <div className="flex items-center gap-3">
                <audio
                  controls
                  src={recorder.result.previewUrl}
                  className="h-9 min-w-0 flex-1"
                />
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatDuration(recorder.result.durationSeconds)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  disabled={saving}
                  onClick={() => void submit(recorder.result!)}
                >
                  {saving ? "Saving…" : "Save note"}
                </Button>
                <Button size="sm" variant="ghost" onClick={recorder.clear}>
                  Discard
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{notes.length} recordings</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="relative">
            <SearchIcon />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                void load(e.target.value);
              }}
              placeholder="Search transcripts…"
              className="pl-8"
            />
          </div>
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No recordings yet. Say something.
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {notes.map((n) => (
                <NoteRow
                  key={n.id}
                  note={n}
                  categories={categories}
                  aiReady={aiReady}
                  onTranscribe={() => void transcribe(n.id)}
                  transcribing={transcribingId === n.id}
                  onChanged={load}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <CategoriesDialog
        open={showCats}
        onOpenChange={setShowCats}
        categories={categories}
        onChanged={async () => {
          setCategories(await listCategories());
        }}
      />
    </div>
  );
}

function SearchIcon() {
  return <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />;
}

function NoteRow({
  note,
  categories,
  aiReady,
  onTranscribe,
  transcribing,
  onChanged,
}: {
  note: VoiceNoteRow;
  categories: Category[];
  aiReady: boolean;
  onTranscribe: () => void;
  transcribing: boolean;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(note.note ?? "");
  const [categoryId, setCategoryId] = useState(note.categoryId ?? "");
  const [updating, setUpdating] = useState(false);

  async function save() {
    setUpdating(true);
    try {
      await updateNote({
        id: note.id,
        categoryId: categoryId || null,
        note: caption,
      });
      setEditing(false);
      await onChanged();
    } finally {
      setUpdating(false);
    }
  }

  async function remove() {
    await deleteNote(note.id);
    await onChanged();
  }

  const selectedName = categories.find((c) => c.id === categoryId)?.name;

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-start gap-3">
        <audio controls src={note.audioUrl} className="h-9 w-44 shrink-0 sm:w-64" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">
            {note.categoryName ? `${note.categoryName} · ` : ""}
            {formatDuration(note.durationSeconds)} ·{" "}
            {new Date(note.createdAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>

          {editing ? (
            <div className="mt-1.5 flex flex-col gap-2">
              <Input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Short caption (optional)"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
                  <SelectTrigger className="w-48" aria-label="Category">
                    <SelectValue placeholder="No category">{selectedName}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" disabled={updating} onClick={() => void save()}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            caption && <p className="mt-1 text-sm font-medium">{caption}</p>
          )}

          <TranscriptStatus
            note={note}
            aiReady={aiReady}
            onTranscribe={onTranscribe}
            transcribing={transcribing}
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => setEditing(true)}
          aria-label="Edit note"
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground"
          onClick={() => void remove()}
          aria-label="Delete note"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  );
}

function TranscriptStatus({
  note,
  aiReady,
  onTranscribe,
  transcribing,
}: {
  note: VoiceNoteRow;
  aiReady: boolean;
  onTranscribe: () => void;
  transcribing: boolean;
}) {
  if (note.transcriptStatus === "done" && note.transcript) {
    return (
      <p className="mt-1.5 whitespace-pre-wrap rounded-md bg-muted/40 px-2.5 py-2 text-sm">
        {note.transcript}
      </p>
    );
  }

  if (!aiReady) {
    return (
      <p className="mt-1.5 text-sm text-muted-foreground italic">
        Transcription unavailable — no API key configured. The audio is saved.
      </p>
    );
  }

  if (note.transcriptStatus === "pending") {
    return (
      <p className="mt-1.5 text-sm text-muted-foreground italic">
        Transcribing… this can take a moment.
      </p>
    );
  }

  const label =
    note.transcriptStatus === "failed"
      ? "Transcription failed. Try again."
      : "No transcript yet.";
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <p className="text-sm text-muted-foreground italic">{label}</p>
      <Button size="sm" variant="outline" disabled={transcribing} onClick={onTranscribe}>
        {transcribing ? "Transcribing…" : "Transcribe"}
      </Button>
    </div>
  );
}

function CategoriesDialog({
  open,
  onOpenChange,
  categories,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onChanged: () => Promise<void>;
}) {
  const [name, setName] = useState("");

  async function add() {
    if (!name.trim()) return;
    await createCategory(name);
    setName("");
    await onChanged();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Categories</DialogTitle>
          <DialogDescription>
            A small starter set is seeded for you. Add or remove freely.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <span className="flex-1 text-sm">{c.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void deleteCategory(c.id).then(onChanged)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
        <DialogFooter className="flex items-center gap-2 sm:justify-start">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New category…"
            onKeyDown={(e) => {
              if (e.key === "Enter") void add();
            }}
          />
          <Button onClick={() => void add()} disabled={!name.trim()}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}