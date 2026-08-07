"use client";

import { useEffect, useState } from "react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Category = { id: string; name: string; color: string };
type Running = {
  id: string;
  categoryId: string | null;
  note: string | null;
  startAt: Date;
};

export function TimerCard({
  categories,
  running,
  onStart,
  onStop,
}: {
  categories: Category[];
  running: Running | null;
  onStart: (categoryId: string | null, note: string) => void;
  onStop: (id: string, energy?: number | null) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [energy, setEnergy] = useState<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const category = running
    ? categories.find((c) => c.id === running.categoryId)
    : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{running ? "Timing" : "Timer"}</CardTitle>
        <CardDescription>
          {running ? "Stop when you switch focus." : "Start a live entry."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {running ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline gap-3">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: category?.color ?? "#8a8f98" }}
              />
              <div className="min-w-0">
                <p className="truncate text-2xl font-medium tabular-nums">
                  {formatElapsed(now - new Date(running.startAt).getTime())}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {category?.name ?? "Uncategorized"}
                  {running.note ? ` · ${running.note}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Energy</span>
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setEnergy(v)}
                  className={cn(
                    "size-7 rounded-md border text-xs tabular-nums transition-colors",
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
            <Button size="lg" onClick={() => onStop(running.id, energy)}>
              Stop
            </Button>
          </div>
        ) : (
          <StartForm categories={categories} onStart={onStart} />
        )}
      </CardContent>
    </Card>
  );
}

function StartForm({
  categories,
  onStart,
}: {
  categories: Category[];
  onStart: (categoryId: string | null, note: string) => void;
}) {
  const [categoryId, setCategoryId] = useState<string>("");
  const [note, setNote] = useState("");
  const selectedName = categories.find((c) => c.id === categoryId)?.name;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
          <SelectTrigger aria-label="Category">
            <SelectValue placeholder="Pick a category">
              {selectedName}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <Button
        disabled={!categoryId && !note}
        onClick={() => onStart(categoryId || null, note)}
      >
        Start
      </Button>
    </div>
  );
}

function formatElapsed(ms: number) {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${h}:${pad(m)}:${pad(s)}`;
}