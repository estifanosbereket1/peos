"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type Entry = {
  id: string;
  categoryId: string | null;
  note: string | null;
  energy: number | null;
  startAt: Date;
  endAt: Date | null;
};

export type Category = { id: string; name: string; color: string };

export type EntrySave = {
  id: string;
  categoryId: string | null;
  note: string;
  startAt: string;
  endAt: string;
  energy: number | null;
};

export function Timeline({
  entries,
  categories,
  from,
  to,
  onUpdate,
  onDelete,
}: {
  entries: Entry[];
  categories: Category[];
  from: Date;
  to: Date;
  onUpdate: (input: EntrySave) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState<Entry | null>(null);

  const dayMs = to.getTime() - from.getTime();
  const blocks = useMemo(() => {
    type B = {
      entry: Entry;
      startMin: number;
      endMin: number;
      color: string;
      name: string;
    };
    const raw: B[] = entries
      .map((e) => {
        const start = Math.max(new Date(e.startAt).getTime(), from.getTime());
        const end = e.endAt
          ? Math.min(new Date(e.endAt).getTime(), to.getTime())
          : to.getTime();
        if (end <= start) return null;
        const c = categories.find((x) => x.id === e.categoryId);
        return {
          entry: e,
          startMin: ((start - from.getTime()) / dayMs) * 1440,
          endMin: ((end - from.getTime()) / dayMs) * 1440,
          color: c?.color ?? "#8a8f98",
          name: c?.name ?? "Uncategorized",
        };
      })
      .filter((x): x is B => x !== null)
      .sort((a, b) => a.startMin - b.startMin);

    // Greedy lane assignment so overlapping blocks don't stack invisibly.
    const lanes: B[][] = [];
    for (const b of raw) {
      const lane = lanes.findIndex(
        (l) => l[l.length - 1].endMin <= b.startMin,
      );
      if (lane === -1) lanes.push([b]);
      else lanes[lane].push(b);
    }
    return lanes;
  }, [entries, categories, from, to, dayMs]);

  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of blocks.flat()) {
      map.set(b.name, (map.get(b.name) ?? 0) + (b.endMin - b.startMin));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [blocks]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        {totals.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nothing tracked this day.
          </p>
        )}
        {totals.map(([name, mins]) => (
          <span
            key={name}
            className="text-xs text-muted-foreground tabular-nums"
          >
            {name} · {formatMins(mins)}
          </span>
        ))}
      </div>

      {/* Timeline */}
      <div className="relative select-none">
        <div className="flex h-5">
          <span className="w-10 shrink-0" />
          {HOURS.map((h) => (
            <span
              key={h}
              className="flex-1 text-[10px] text-muted-foreground/70 tabular-nums"
            >
              {h}
            </span>
          ))}
        </div>
        <div className="flex">
          <div className="w-10 shrink-0" />
          {blocks.map((lane, li) => (
            <div
              key={li}
              className="relative h-8 flex-1"
              style={{
                backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent calc(100%/24 - 1px), var(--border) calc(100%/24 - 1px), var(--border) calc(100%/24))`,
              }}
            >
              {lane.map((b) => (
                <button
                  key={b.entry.id}
                  type="button"
                  onClick={() => setEditing(b.entry)}
                  title={`${b.name}${b.entry.note ? " — " + b.entry.note : ""}`}
                  className="group absolute top-0.5 bottom-0.5 flex cursor-pointer items-center overflow-hidden rounded-sm px-1.5 text-left transition-opacity hover:opacity-80"
                  style={{
                    left: `${(b.startMin / 1440) * 100}%`,
                    width: `${Math.max(((b.endMin - b.startMin) / 1440) * 100, 0.4)}%`,
                    background: b.color,
                  }}
                >
                  {b.endMin - b.startMin >= 60 && (
                    <span className="truncate text-[10px] font-medium text-white/90">
                      {b.name}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* List */}
      <ul className="flex flex-col divide-y">
        {entries
          .slice()
          .sort((a, b) => b.startAt.getTime() - a.startAt.getTime())
          .map((e) => {
            const c = categories.find((x) => x.id === e.categoryId);
            const dur = e.endAt
              ? new Date(e.endAt).getTime() - new Date(e.startAt).getTime()
              : null;
            return (
              <li key={e.id} className="flex items-center gap-3 py-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: c?.color ?? "#8a8f98" }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {c?.name ?? "Uncategorized"}
                    {e.note ? <span className="text-muted-foreground"> · {e.note}</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatTime(new Date(e.startAt))}
                    {e.endAt
                      ? `–${formatTime(new Date(e.endAt))} · ${formatDur(dur!)}`
                      : " · running"}
                    {e.energy != null && ` · energy ${e.energy}/5`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(e)}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(e.id)}
                >
                  Delete
                </Button>
              </li>
            );
          })}
      </ul>

      {editing && (
        <EntryDialog
          key={editing.id}
          entry={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSave={(input) => {
            onUpdate({ ...input, id: editing.id });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

export function EntryDialog({
  entry,
  categories,
  onClose,
  onSave,
}: {
  entry: Entry | null;
  categories: Category[];
  onClose: () => void;
  onSave: (input: {
    id?: string;
    categoryId: string | null;
    note: string;
    startAt: string;
    endAt: string;
    energy: number | null;
  }) => void;
}) {
  const [start, setStart] = useState(() =>
    entry ? toLocalInput(entry.startAt) : defaultNowInput(),
  );
  const [end, setEnd] = useState(() =>
    entry?.endAt ? toLocalInput(entry.endAt) : "",
  );
  const [categoryId, setCategoryId] = useState<string>(
    entry?.categoryId ?? "",
  );
  const [note, setNote] = useState(entry?.note ?? "");
  const [energy, setEnergy] = useState<number | null>(entry?.energy ?? null);
  const selectedName = categories.find((c) => c.id === categoryId)?.name;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{entry ? "Edit entry" : "Add entry"}</DialogTitle>
          <DialogDescription>
            {entry
              ? "Correct anything you logged."
              : "Backfill a block of your day."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cat">Category</Label>
            <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
              <SelectTrigger id="cat">
                <SelectValue placeholder="None">{selectedName}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="start">Start</Label>
              <Input
                id="start"
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="end">End</Label>
              <Input
                id="end"
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
<div className="flex flex-col gap-1.5">
              <Label htmlFor="note">Note</Label>
              <Textarea
                id="note"
                placeholder="What were you doing?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Energy</Label>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setEnergy(v)}
                    className={cn(
                      "size-8 rounded-md border text-sm tabular-nums transition-colors",
                      energy === v
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:bg-muted",
                    )}
                    aria-pressed={energy === v}
                    aria-label={`Energy ${v} of 5`}
                  >
                    {v}
                  </button>
                ))}
                {energy != null && (
                  <button
                    type="button"
                    onClick={() => setEnergy(null)}
                    className="ml-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    clear
                  </button>
                )}
              </div>
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!start || !end}
            onClick={() =>
              onSave({
                id: entry?.id,
                categoryId: categoryId || null,
                note,
                startAt: new Date(start).toISOString(),
                endAt: new Date(end).toISOString(),
                energy,
              })
            }
          >
            {entry ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatMins(mins: number) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatDur(ms: number) {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function defaultNowInput() {
  return toLocalInput(new Date());
}