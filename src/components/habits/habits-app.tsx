"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";

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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { HabitWithStatus } from "@/lib/habits";
import {
  createHabit,
  deleteHabit,
  getHeatmap,
  listHabits,
  toggleHabit,
  type HeatmapEntry,
} from "@/app/(app)/habits/actions";
import { cn } from "@/lib/utils";

export function HabitsApp() {
  const [habits, setHabits] = useState<HabitWithStatus[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapEntry[]>([]);

  const load = useCallback(async () => {
    const [h, hm] = await Promise.all([listHabits(), getHeatmap()]);
    setHabits(h);
    setHeatmap(hm);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-4">
      <AddHabit onAdded={load} />

      {habits.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            No habits yet. Add the one thing you want to make automatic. A day
            counts until 4am.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Daily habits</CardTitle>
            <CardDescription>A log counts within the same 4am day.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {habits.map((h) => (
              <div key={h.id} className="flex items-center gap-3 py-2.5">
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      await toggleHabit(h.id);
                      await load();
                    })();
                  }}
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-md border transition-colors",
                    h.doneToday
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input hover:bg-muted",
                  )}
                  aria-pressed={h.doneToday}
                  aria-label={h.doneToday ? "Mark not done" : "Mark done"}
                >
                  {h.doneToday && <Check className="size-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{h.name}</p>
                  {h.description && (
                    <p className="truncate text-xs text-muted-foreground">
                      {h.description}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {h.streak === 0
                    ? "not started"
                    : `${h.streak} day${h.streak === 1 ? "" : "s"}`}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => {
                    void (async () => {
                      await deleteHabit(h.id);
                      await load();
                    })();
                  }}
                  aria-label={`Delete ${h.name}`}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <HeatmapCard days={heatmap} totalHabits={habits.length} />
    </div>
  );
}

function AddHabit({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" className="self-start" onClick={() => setOpen(true)}>
        <Plus /> Add habit
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New habit</DialogTitle>
          <DialogDescription>
            Keep it small enough to do on a bad day.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              await createHabit(name, description);
              setName("");
              setDescription("");
              setOpen(false);
              onAdded();
            })();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="habit-name">Name</Label>
            <Input
              id="habit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Read 20 minutes"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="habit-desc">Note (optional)</Label>
            <Input
              id="habit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Why it matters…"
            />
          </div>
          <Button type="submit" disabled={!name.trim()} className="self-start">
            Create
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function HeatmapCard({
  days,
  totalHabits,
}: {
  days: HeatmapEntry[];
  totalHabits: number;
}) {
  const map = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of days) m.set(d.dayKey, d.count);
    return m;
  }, [days]);

  const weeks = useMemo(() => buildWeeks(91), []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
        <CardDescription>
          How many habits you completed, last 13 weeks.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          {weeks.map((week) => (
            <div key={week.key} className="flex items-center gap-1">
              <span className="w-7 shrink-0 text-[10px] text-muted-foreground">
                {week.monthLabel}
              </span>
              <div className="flex gap-1">
                {week.keys.map((k) => {
                  const count = map.get(k) ?? 0;
                  const level =
                    totalHabits === 0
                      ? 0
                      : Math.min(3, Math.round((count / totalHabits) * 3));
                  return (
                    <div
                      key={k}
                      title={`${k}: ${count}/${totalHabits}`}
                      className={cn(
                        "size-3 rounded-[3px]",
                        level === 0 && "bg-muted",
                        level === 1 && "bg-primary/25",
                        level === 2 && "bg-primary/55",
                        level === 3 && "bg-primary",
                      )}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>Less</span>
          <span className="size-3 rounded-[3px] bg-muted" />
          <span className="size-3 rounded-[3px] bg-primary/25" />
          <span className="size-3 rounded-[3px] bg-primary/55" />
          <span className="size-3 rounded-[3px] bg-primary" />
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  );
}

const MONTHS = [
  "",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function keyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function keyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/** Monday + subsequent 6 day keys for the week containing `dayKey`. */
function weekKeys(dayKey: string): string[] {
  const dt = keyToDate(dayKey);
  const off = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - off);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(dt);
    d.setDate(d.getDate() + i);
    return keyOf(d);
  });
}

/** 7-day columns (Mon–Sun) covering the last `totalDays` days, ending today. */
function buildWeeks(totalDays: number): {
  key: string;
  monthLabel: string;
  keys: string[];
}[] {
  const today = keyOf(new Date());
  const edge = keyToDate(shiftKey(today, -totalDays + 1));
  const firstMonday = weekKeys(keyOf(edge))[0];
  const end = keyToDate(today);

  const weeks: { key: string; monthLabel: string; keys: string[] }[] = [];
  const cur = keyToDate(firstMonday);
  let lastMonth = 0;
  while (cur <= end) {
    const keys = weekKeys(keyOf(cur));
    const month = Number(keys[0].slice(5, 7));
    const label = month !== lastMonth ? MONTHS[month] : "";
    lastMonth = month;
    weeks.push({ key: keys[0], monthLabel: label, keys });
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}

function shiftKey(dayKey: string, n: number): string {
  const dt = keyToDate(dayKey);
  dt.setDate(dt.getDate() + n);
  return keyOf(dt);
}