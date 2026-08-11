"use client";

import { Button } from "@/components/ui/button";
import { dayKeyToInstant, shiftDayKey, todayKey } from "@/lib/time";

export function DayNav({
  dayKey,
  onChange,
  label,
}: {
  dayKey: string;
  onChange: (key: string) => void;
  label?: string;
}) {
  const isToday = dayKey === todayKey();
  const d = dayKeyToInstant(dayKey, 0);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={() => onChange(shiftDayKey(dayKey, -1))}
        aria-label="Previous day"
      >
        ←
      </Button>
      <span className="min-w-40 flex-1 text-center text-sm font-medium sm:flex-none">
        {isToday
          ? label ?? "Today"
          : d.toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
      </span>
      <Button
        variant="outline"
        size="icon"
        onClick={() => onChange(shiftDayKey(dayKey, 1))}
        aria-label="Next day"
      >
        →
      </Button>
      {!isToday && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange(todayKey())}
        >
          Back to today
        </Button>
      )}
    </div>
  );
}