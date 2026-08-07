"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import {
  deleteFast,
  getActiveFast,
  listFasts,
  startFast,
  stopFast,
  type Fast,
} from "@/app/(app)/fasting/actions";

const TARGETS = [8, 12, 14, 16, 18, 24];

export function FastingApp() {
  const [active, setActive] = useState<Fast | null>(null);
  const [history, setHistory] = useState<Fast[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const [a, h] = await Promise.all([getActiveFast(), listFasts()]);
    setActive(a);
    setHistory(h);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{active ? "Fasting" : "Start a fast"}</CardTitle>
          <CardDescription>
            {active
              ? "Track time since your last meal."
              : "Pick a goal and begin. Stop whenever you eat."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {active ? (
            <ActiveCard
              fast={active}
              now={now}
              onStop={async () => {
                const stopped = await stopFast(active.id);
                if (stopped) await load();
              }}
            />
          ) : (
            <StartForm
              onStart={async (goalHours, note) => {
                await startFast(goalHours, note);
                await load();
              }}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No fasts recorded yet.
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {history.map((f) => (
                <li key={f.id} className="flex items-center gap-3 py-2.5">
                  <span className="text-sm font-medium tabular-nums">
                    {formatDuration(durationMs(f, now))}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatRange(f)}
                  </span>
                  {f.goalHours && (
                    <span
                      className={cn(
                        "text-xs",
                        f.endAt && hoursBetween(f.startAt, f.endAt) >= f.goalHours
                          ? "text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      goal {f.goalHours}h
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto size-7"
                    onClick={() => {
                      void (async () => {
                        await deleteFast(f.id);
                        await load();
                      })();
                    }}
                    aria-label="Delete fast"
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ActiveCard({
  fast,
  now,
  onStop,
}: {
  fast: Fast;
  now: number;
  onStop: () => void;
}) {
  const elapsedMs = Math.max(0, now - new Date(fast.startAt).getTime());
  const goalMs = fast.goalHours ? fast.goalHours * 3_600_000 : null;
  const hasGoal = goalMs != null;
  const remainingMs = hasGoal ? Math.max(0, goalMs! - elapsedMs) : null;
  const progress = hasGoal ? Math.min(1, elapsedMs / goalMs!) : null;
  const pct = progress != null ? Math.round(progress * 100) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        {hasGoal && remainingMs != null && pct != null ? (
          <>
            <p className="flex flex-wrap items-baseline gap-x-2 leading-tight">
              <span className="text-3xl font-medium tabular-nums">
                {formatDuration(remainingMs)}
              </span>
              <span className="text-sm text-muted-foreground">
                left · {pct}% of {fast.goalHours}h goal
              </span>
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatDuration(elapsedMs)} elapsed
            </p>
          </>
        ) : (
          <p className="text-3xl font-medium tabular-nums">
            {formatDuration(elapsedMs)}
          </p>
        )}
      </div>
      {progress != null && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {fast.note && (
        <p className="text-sm text-muted-foreground">{fast.note}</p>
      )}
      <Button size="lg" className="self-start" onClick={onStop}>
        Break fast
      </Button>
    </div>
  );
}

function StartForm({
  onStart,
}: {
  onStart: (goalHours: number | null, note: string) => void;
}) {
  const [goal, setGoal] = useState<number | null>(16);
  const [note, setNote] = useState("");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label>Goal length</Label>
        <div className="flex flex-wrap gap-1.5">
          {TARGETS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setGoal(v)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm tabular-nums transition-colors",
                goal === v
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
              aria-pressed={goal === v}
            >
              {v}h
            </button>
          ))}
          <button
            type="button"
            onClick={() => setGoal(null)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-colors",
              goal === null
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-muted",
            )}
            aria-pressed={goal === null}
          >
            No goal
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fast-note">Note (optional)</Label>
        <Input
          id="fast-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What are you aiming for?"
        />
      </div>
      <Button className="self-start" onClick={() => onStart(goal, note)}>
        Start
      </Button>
    </div>
  );
}

function hoursBetween(start: Date | string, end: Date | string) {
  return Math.max(
    0,
    (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000,
  );
}

function durationMs(f: Fast, now: number) {
  const end = f.endAt ? new Date(f.endAt).getTime() : now;
  return Math.max(0, end - new Date(f.startAt).getTime());
}

function formatDuration(ms: number) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatRange(f: Fast) {
  const s = pad(new Date(f.startAt));
  if (!f.endAt) return `started ${s}`;
  return `${s} → ${pad(new Date(f.endAt))}`;
}

function pad(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}