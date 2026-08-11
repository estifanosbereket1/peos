"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { DayNav } from "@/components/day-nav";
import {
  addTask,
  deleteTask,
  getDayPlan,
  moveTask,
  toggleTask,
} from "@/app/(app)/plan/actions";
import {
  getWeekAnchorsForDay,
  setAnchors,
} from "@/app/(app)/week/actions";
import { todayKey, weekStartKey } from "@/lib/time";
import { cn } from "@/lib/utils";

type Task = {
  id: string;
  text: string;
  completed: boolean;
  sortOrder: number;
};

export function DailyPlanApp() {
  const [dayKey, setDayKey] = useState(() => todayKey());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [anchors, setAnchorsState] = useState<string[]>([]);
  const [input, setInput] = useState("");

  const load = useCallback(async (key: string) => {
    const [plan, weekAnchors] = await Promise.all([
      getDayPlan(key),
      getWeekAnchorsForDay(key),
    ]);
    setTasks(plan);
    setAnchorsState(weekAnchors.map((a) => a.text));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(dayKey);
  }, [dayKey, load]);

  const completed = tasks.filter((t) => t.completed).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <DayNav dayKey={dayKey} onChange={setDayKey} label="Today" />
        <span className="ml-auto text-sm text-muted-foreground tabular-nums">
          {completed}/{tasks.length} done
        </span>
      </div>

      <AnchorsEditor
        anchors={anchors}
        onChanged={async (texts) => {
          await setAnchors(weekStartKey(dayKey), texts);
          await load(dayKey);
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Plan for the day</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <TaskList
            tasks={tasks}
            onToggle={async (id, completed) => {
              await toggleTask(id, completed);
              await load(dayKey);
            }}
            onDelete={async (id) => {
              await deleteTask(id);
              await load(dayKey);
            }}
            onMove={async (id, dir) => {
              await moveTask(id, dir);
              await load(dayKey);
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
                await load(dayKey);
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
    </div>
  );
}

/** Weekly anchors shown on the day page — editable inline. */
function AnchorsEditor({
  anchors,
  onChanged,
}: {
  anchors: string[];
  onChanged: (texts: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(anchors);

  const save = async () => {
    await onChanged(draft.map((t) => t.trim()).filter(Boolean));
    setEditing(false);
  };

  return (
    <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          This week&apos;s anchors
        </p>
        {!editing && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-xs"
            onClick={() => {
              setDraft(anchors);
              setEditing(true);
            }}
          >
            <Pencil /> Edit
          </Button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-2 pt-2">
          {draft.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-muted-foreground/50">{i + 1}.</span>
              <Input
                value={t}
                onChange={(e) =>
                  setDraft(draft.map((x, xi) => (xi === i ? e.target.value : x)))
                }
                className="h-8"
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Remove anchor"
                onClick={() => setDraft(draft.filter((_, xi) => xi !== i))}
              >
                <X />
              </Button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="self-start gap-1"
            onClick={() => setDraft([...draft, ""])}
          >
            <Plus /> Add anchor
          </Button>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={draft.filter(Boolean).length === 0}>
              Save
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : anchors.length === 0 ? (
        <p className="pt-1 text-muted-foreground">
          No anchors set for this week.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-x-4 gap-y-0.5 pt-1">
          {anchors.map((a, i) => (
            <li key={i} className="flex items-center gap-1.5 text-muted-foreground">
              <span className="text-muted-foreground/50">{i + 1}.</span>
              {a}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TaskList({
  tasks,
  onToggle,
  onDelete,
  onMove,
}: {
  tasks: Task[];
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: "up" | "down") => void;
}) {
  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">No tasks yet.</p>;
  }
  return (
    <ul className="flex flex-col">
      {tasks.map((t, i) => (
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
              "min-w-0 flex-1 break-words text-sm",
              t.completed && "text-muted-foreground line-through",
            )}
          >
            {t.text}
          </span>
          <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              disabled={i === 0}
              onClick={() => onMove(t.id, "up")}
              aria-label="Move up"
            >
              <ArrowUp />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={i === tasks.length - 1}
              onClick={() => onMove(t.id, "down")}
              aria-label="Move down"
            >
              <ArrowDown />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(t.id)}
              aria-label="Delete task"
            >
              <Trash2 />
            </Button>
          </span>
        </li>
      ))}
    </ul>
  );
}