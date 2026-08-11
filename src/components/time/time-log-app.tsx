"use client";

import { useCallback, useEffect, useState } from "react";

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
  createCategory,
  createEntry,
  deleteCategory,
  deleteEntry,
  getDayEntries,
  listCategories,
  startTimer,
  stopTimer,
  updateEntry,
} from "@/app/(app)/time/actions";
import { dayKeyToInstant, shiftDayKey, todayKey } from "@/lib/time";

import { Timeline, EntryDialog, type Category, type Entry } from "./timeline";
import { TimerCard } from "./timer-card";

export function TimeLogApp({
  categories: initialCategories,
}: {
  categories: Category[];
}) {
  const [dayKey, setDayKey] = useState(() => todayKey());
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async (key: string) => {
    const from = dayKeyToInstant(key, 0);
    const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
    const rows = await getDayEntries(from.toISOString(), to.toISOString());
    setEntries(rows as Entry[]);
  }, []);

  // Fetch entries for the selected day (client-driven feature; fetch then
  // hydrate state — setState happens after await, not synchronously).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(dayKey);
  }, [dayKey, load]);

  async function reload() {
    const cats = await listCategories();
    setCategories(cats);
    await load(dayKey);
  }

  const running = entries.find((e) => !e.endAt) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <DayNav dayKey={dayKey} onChange={setDayKey} />
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdd(true)}
          >
            Add block
          </Button>
          <CategoriesManager
            categories={categories}
            onChanged={reload}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <TimerCard
          categories={categories}
          running={running}
          onStart={async (categoryId, note) => {
            const now = new Date().toISOString();
            const created = await startTimer(categoryId, note, now);
            if (created) await load(dayKey);
          }}
          onStop={async (id, energy) => {
            const now = new Date().toISOString();
            await stopTimer(id, now, energy);
            await load(dayKey);
          }}
        />
        <div>
          <Timeline
            entries={entries}
            categories={categories}
            from={dayKeyToInstant(dayKey, 0)}
            to={new Date(dayKeyToInstant(dayKey, 0).getTime() + 24 * 60 * 60 * 1000)}
            onUpdate={async (input) => {
              await updateEntry({
                id: input.id,
                categoryId: input.categoryId,
                note: input.note,
                startAt: input.startAt,
                endAt: input.endAt,
                energy: input.energy,
              });
              await load(dayKey);
            }}
            onDelete={async (id) => {
              await deleteEntry(id);
              await load(dayKey);
            }}
          />
        </div>
      </div>

      {showAdd && (
        <EntryDialog
          entry={null}
          categories={categories}
          onClose={() => setShowAdd(false)}
          onSave={async (input) => {
            if (input.id) {
              await updateEntry({
                id: input.id,
                categoryId: input.categoryId,
                note: input.note,
                startAt: input.startAt,
                endAt: input.endAt,
                energy: input.energy,
              });
            } else {
              await createEntry({
                categoryId: input.categoryId,
                note: input.note,
                startAt: input.startAt,
                endAt: input.endAt,
                energy: input.energy,
              });
            }
            setShowAdd(false);
            await load(dayKey);
          }}
        />
      )}
    </div>
  );
}

function DayNav({
  dayKey,
  onChange,
}: {
  dayKey: string;
  onChange: (key: string) => void;
}) {
  const isToday = dayKey === todayKey();
  const d = dayKeyToInstant(dayKey, 0);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="icon" onClick={() => onChange(shiftDayKey(dayKey, -1))}>
        ←
      </Button>
      <span className="min-w-40 flex-1 text-center text-sm font-medium sm:flex-none">
        {isToday
          ? "Today"
          : d.toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
      </span>
      <Button variant="outline" size="icon" onClick={() => onChange(shiftDayKey(dayKey, 1))}>
        →
      </Button>
      {!isToday && (
        <Button variant="ghost" size="sm" onClick={() => onChange(todayKey())}>
          Back to today
        </Button>
      )}
    </div>
  );
}

function CategoriesManager({
  categories,
  onChanged,
}: {
  categories: Category[];
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  async function add() {
    if (!name.trim()) return;
    await createCategory(name);
    setName("");
    await onChanged();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Categories
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Categories</DialogTitle>
            <DialogDescription>
              Your editable list. Colors map to the timeline.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: c.color }}
                />
                <span className="flex-1 text-sm">{c.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await deleteCategory(c.id);
                    await onChanged();
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="new-cat" className="sr-only">
              Category name
            </Label>
            <Input
              id="new-cat"
              placeholder="New category"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
            <Button onClick={add} disabled={!name.trim()}>
              Add
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}