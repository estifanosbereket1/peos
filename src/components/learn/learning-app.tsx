"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Search, Trash2 } from "lucide-react";

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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { DayNav } from "@/components/day-nav";
import type { LearningLogRow as LogRow } from "@/lib/learning-row";
import {
  addTopic,
  createLog,
  deleteLog,
  getDayLog,
  getSuggestions,
  listTopics,
  removeTopic,
  searchLogs,
} from "@/app/(app)/learn/actions";
import { todayKey } from "@/lib/time";
import { cn } from "@/lib/utils";

type Suggestion = {
  topic: string;
  source: "suggestion" | "user" | "ai";
  reason?: string;
};
type Topic = { id: string; name: string };

const SOURCE_LABEL: Record<Suggestion["source"], string> = {
  suggestion: "suggested",
  user: "your list",
  ai: "ai",
};

export function LearningApp() {
  const [dayKey, setDayKey] = useState(() => todayKey());
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [topic, setTopic] = useState("");
  const [content, setContent] = useState("");
  const [explainBack, setExplainBack] = useState("");
  const [source, setSource] = useState<Suggestion["source"]>("user");
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<LogRow[]>([]);

  const load = useCallback(async (key: string) => {
    const [dayLogs, sugg] = await Promise.all([
      getDayLog(key),
      getSuggestions(key),
    ]);
    setLogs(dayLogs);
    setSuggestions(sugg);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(dayKey);
  }, [dayKey, load]);

  const submit = async () => {
    const t = topic.trim();
    const c = content.trim();
    if (!t || !c) return;
    await createLog(dayKey, t, c, source, explainBack);
    setContent("");
    setExplainBack("");
    await load(dayKey);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <DayNav dayKey={dayKey} onChange={setDayKey} label="Today" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Suggestions */}
        <Card>
          <CardHeader>
            <CardTitle>What could I learn today?</CardTitle>
            <CardDescription>
              From your topics list and rotating dev themes. Pick one to write
              about.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {suggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add topics below to personalize your suggestions.
              </p>
            ) : (
              suggestions.map((s) => (
                <button
                  key={s.topic}
                  type="button"
                  onClick={() => {
                    setTopic(s.topic);
                    setSource(s.source);
                  }}
                  className={cn(
                    "group flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    topic === s.topic
                      ? "border-primary/50 bg-primary/5"
                      : "hover:bg-muted",
                  )}
                >
                  <BookOpen className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{s.topic}</span>
                    {s.reason ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {s.reason}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {s.reason ? "suggested for you" : SOURCE_LABEL[s.source]}
                  </span>
                </button>
              ))
            )}
            <TopicsManager />
          </CardContent>
        </Card>

        {/* Entry form */}
        <Card>
          <CardHeader>
            <CardTitle>Write it down</CardTitle>
            <CardDescription>
              One thing learned, an insight, or a rough note.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="topic">Topic</Label>
              <Input
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Event loop, tailwind, pricing"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="content">What did you learn?</Label>
              <Textarea
                id="content"
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Explain it in your own words…"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="explain-back">Teach it back (optional)</Label>
              <Textarea
                id="explain-back"
                rows={3}
                value={explainBack}
                onChange={(e) => setExplainBack(e.target.value)}
                placeholder="If you had to explain this to someone else, what would you say?"
              />
            </div>
            <Button
              onClick={submit}
              disabled={!topic.trim() || !content.trim()}
              className="self-start"
            >
              Save
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Today's log */}
      <Card>
        <CardHeader>
          <CardTitle>Logged today</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing logged for this day yet.
            </p>
          ) : (
            <LogList
              logs={logs}
              onDelete={async (id) => {
                await deleteLog(id);
                await load(dayKey);
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* History + search */}
      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>Search everything you&apos;ve logged.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes…"
              className="pl-8"
            />
          </div>
          {query ? (
            <SearchResults query={query} onResults={setHistory} />
          ) : history.length > 0 ? (
            <LogList
              logs={history}
              compact
              onDelete={async (id) => {
                await deleteLog(id);
                setHistory(history.filter((l) => l.id !== id));
                if (dayKey === logs.find((l) => l.id === id)?.learnDate)
                  await load(dayKey);
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Type to search past notes.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LogList({
  logs,
  onDelete,
  compact,
}: {
  logs: LogRow[];
  onDelete?: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <ul className="flex flex-col divide-y">
      {logs.map((l) => (
        <li key={l.id} className="flex flex-col gap-1 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{l.topic}</span>
            <span className="text-xs text-muted-foreground">
              {SOURCE_LABEL[l.source]}
            </span>
            {!compact && (
              <span className="text-xs text-muted-foreground">{l.learnDate}</span>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto size-7"
                onClick={() => onDelete(l.id)}
                aria-label="Delete entry"
              >
                <Trash2 />
              </Button>
            )}
          </div>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {l.content}
          </p>
          {l.explainBack && (
            <div className="mt-1 rounded-md bg-muted/40 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Teach it back
              </p>
              <p className="whitespace-pre-wrap text-sm">{l.explainBack}</p>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function SearchResults({
  query,
  onResults,
}: {
  query: string;
  onResults: (logs: LogRow[]) => void;
}) {
  const [logs, setLogs] = useState<LogRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    searchLogs(query).then((r) => {
      if (alive) {
        setLogs(r);
        onResults(r);
      }
    });
    return () => {
      alive = false;
    };
  }, [query, onResults]);

  if (!logs) {
    return <p className="text-sm text-muted-foreground">Searching…</p>;
  }
  if (logs.length === 0) {
    return <p className="text-sm text-muted-foreground">No matches.</p>;
  }
  return <LogList logs={logs} compact />;
}

function TopicsManager() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setTopics(await listTopics());
  }, []);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      load();
    }
  }, [open, load]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="self-start">
            Manage topics
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your learning topics</DialogTitle>
          <DialogDescription>
            These feed your daily suggestions.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              await addTopic(name);
              setName("");
              await load();
            })();
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add a topic…"
          />
          <Button type="submit" disabled={!name.trim()}>
            Add
          </Button>
        </form>
        <ul className="flex flex-col divide-y">
          {topics.map((t) => (
            <li key={t.id} className="flex items-center gap-2 py-2">
              <span className="flex-1 text-sm">{t.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => {
                  void (async () => {
                    await removeTopic(t.id);
                    await load();
                  })();
                }}
                aria-label={`Remove ${t.name}`}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
          {topics.length === 0 && (
            <li className="py-2 text-sm text-muted-foreground">
              No topics yet. Add the things you care about.
            </li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}