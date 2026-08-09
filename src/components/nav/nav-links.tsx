"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Today" },
  { href: "/time", label: "Time" },
  { href: "/plan", label: "Plan" },
  { href: "/week", label: "Week" },
  { href: "/learn", label: "Learn" },
  { href: "/review", label: "Review" },
  { href: "/habits", label: "Habits" },
  { href: "/fasting", label: "Fasting" },
  { href: "/proof", label: "Proof" },
  { href: "/voice", label: "Voice" },
  { href: "/money", label: "Money" },
  { href: "/analytics", label: "Analytics" },
];

export function NavLinks() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {nav.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-2 py-1 text-sm",
              active
                ? "font-semibold text-foreground underline underline-offset-4 decoration-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}