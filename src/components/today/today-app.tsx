"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { TimerCard } from "@/components/time/timer-card";
import { Entry as TimeEntry } from "@/components/time/timeline";
import {
  addTask,
  deleteTask,
  getDayPlan,
  toggleTask,
} from "@/app/(app)/plan/actions";
import {
  getDayEntries,
  listCategories,
  startTimer,
  stopTimer,
} from "@/app/(app)/time/actions";
import {
  listHabits,
  toggleHabit,
} from "@/app/(app)/habits/actions";
import type { HabitWithStatus } from "@/lib/habits";
import { getGrowthSnapshot, type GrowthSnapshot } from "@/app/(app)/dashboard/actions";
import { getProofCount, getRandomProof } from "@/app/(app)/proof/actions";
import { dayKeyToInstant, todayKey } from "@/lib/time";

type Task = {
  id: string;
  text: string;
  completed: boolean;
  sortOrder: number;
};

type Category = { id: string; name: string; color: string };

export function TodayApp() {
  const dayKey = todayKey();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<HabitWithStatus[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [input, setInput] = useState("");

  const load = useCallback(async () => {
    const from = dayKeyToInstant(dayKey, 0);
    const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
    const [plan, h, cats, rows] = await Promise.all([
      getDayPlan(dayKey),
      listHabits(),
      listCategories(),
      getDayEntries(from.toISOString(), to.toISOString()),
    ]);
    setTasks(plan);
    setHabits(h);
    setCategories(cats);
    setEntries(rows as TimeEntry[]);
  }, [dayKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const running = entries.find((e) => !e.endAt) ?? null;
  const completed = tasks.filter((t) => t.completed).length;
  const habitsDone = habits.filter((h) => h.doneToday).length;

  const todayNow = () => new Date().toISOString();

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Today — the working surface */}
      <div className="flex flex-col gap-6">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-semibold">Today</h1>
          <span className="text-sm text-muted-foreground tabular-nums">
            {tasks.length > 0 && `${completed}/${tasks.length} tasks · `}
            {habits.length > 0 && `${habitsDone}/${habits.length} habits`}
          </span>
        </div>

        <TimerCard
          categories={categories}
          running={running}
          onStart={async (categoryId, note) => {
            const created = await startTimer(categoryId, note, todayNow());
            if (created) await load();
          }}
          onStop={async (id) => {
            await stopTimer(id, todayNow());
            await load();
          }}
        />

        <Card>
          <CardHeader>
            <CardTitle>Plan</CardTitle>
            <CardDescription>What needs doing today.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <TaskList
              tasks={tasks}
              onToggle={async (id, completed) => {
                await toggleTask(id, completed);
                await load();
              }}
              onDelete={async (id) => {
                await deleteTask(id);
                await load();
              }}
            />
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!input.trim()) return;
                void (async () => {
                  await addTask(dayKey, input);
                  setInput("");
                  await load();
                })();
              }}
            >
              <Input
                placeholder="Add a task…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <Button type="submit" disabled={!input.trim()}>
                Add
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Habits</CardTitle>
            <CardDescription>A log counts within the same 4am day.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {habits.length === 0 ? (
              <p className="py-1 text-sm text-muted-foreground">
                No habits yet —{" "}
                <Link href="/habits" className="underline underline-offset-3">
                  add one on the Habits page
                </Link>
                .
              </p>
            ) : (
              habits.map((h) => (
                <div key={h.id} className="flex items-center gap-3 py-2">
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
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm",
                      h.doneToday && "text-muted-foreground line-through",
                    )}
                  >
                    {h.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {h.streak === 0
                      ? "not started"
                      : `${h.streak} day${h.streak === 1 ? "" : "s"}`}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col divide-y py-1 text-sm">
            <JourneyRow label="Wrap-up — night review" hint="Not yet" href="/review" />
            <JourneyRow label="End-of-day reflection" hint="Write it down" href="/review" />
          </CardContent>
        </Card>
      </div>

      {/* Growth */}
      <GrowthColumn />
    </div>
  );
}

function JourneyRow({
  label,
  hint,
  href,
}: {
  label: string;
  hint: string;
  href: string;
}) {
  return (
    <Link href={href} className="flex items-center justify-between py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1 text-foreground">
        {hint}
        <ArrowRight className="size-3.5" />
      </span>
    </Link>
  );
}

function TaskList({
  tasks,
  onToggle,
  onDelete,
}: {
  tasks: Task[];
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}) {
  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">No tasks yet.</p>;
  }
  return (
    <ul className="flex flex-col">
      {tasks.map((t) => (
        <li key={t.id} className="group flex items-center gap-2 py-1.5">
          <button
            type="button"
            onClick={() => onToggle(t.id, !t.completed)}
            className={cn(
              "grid size-5 shrink-0 place-items-center rounded border",
              t.completed
                ? "bg-primary text-primary-foreground"
                : "border-input hover:bg-muted",
            )}
            aria-label={t.completed ? "Mark not done" : "Mark done"}
          >
            {t.completed && <Check className="size-3.5" />}
          </button>
          <span
            className={cn(
              "flex-1 text-sm",
              t.completed && "text-muted-foreground line-through",
            )}
          >
            {t.text}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={() => onDelete(t.id)}
            aria-label="Delete task"
          >
            <Trash2 />
          </Button>
        </li>
      ))}
    </ul>
  );
}

// Growth column lifted from the previous dashboard — reflection/trend only.
function GrowthColumn() {
  const [growth, setGrowth] = useState<GrowthSnapshot | null>(null);
  const [proofCount, setProofCount] = useState<number | null>(null);
  const [reminder, setReminder] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [g, count, r] = await Promise.all([
      getGrowthSnapshot(),
      getProofCount(),
      getRandomProof(),
    ]);
    setGrowth(g);
    setProofCount(count);
    setReminder(r);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Growth</CardTitle>
        <CardDescription>Am I actually growing?</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {growth ? (
          <>
            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground">Weekly anchors</p>
              {growth.anchors.length === 0 ? (
                <p className="text-sm">
                  <Link href="/week" className="underline underline-offset-3">
                    Set your anchors for this week
                  </Link>
                </p>
              ) : (
                <ul className="flex flex-col gap-0.5 text-sm">
                  {growth.anchors.map((a, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          a.followed ? "bg-primary" : "bg-muted-foreground/50",
                        )}
                      />
                      <span className={cn(a.followed && "text-muted-foreground line-through")}>
                        {a.text}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grid grid-cols-4 gap-3 text-center">
              <MiniStat label="Habits" value={growth.habitsDone} href="/habits" />
              <MiniStat label="Learnings" value={growth.learningEntries} href="/learn" />
              <MiniStat label="Reviews" value={growth.reviews} href="/review" />
              <MiniStat label="Proof" value={proofCount ?? 0} href="/proof" />
            </div>

            {reminder && (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Remember
                </p>
                <p className="mt-0.5">{reminder}</p>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {growth.anchorsReviewed
                ? "Week reviewed — nice."
                : "Review this week on the Week page."}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
      </CardContent>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-0.5 rounded-md border py-2 hover:bg-muted"
    >
      <span className="text-lg font-medium tabular-nums">{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </Link>
  );
}