"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { Button } from "@/components/ui/button";
import { PeosLogo } from "@/components/brand/peos-logo";
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
  { href: "/library", label: "Library" },
  { href: "/voice", label: "Voice" },
  { href: "/money", label: "Money" },
  { href: "/analytics", label: "Analytics" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            aria-label="Open navigation"
          >
            <Menu />
          </Button>
        }
      />
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 duration-150 data-open:animate-in data-open:fade-in data-closed:animate-out data-closed:fade-out" />
        <DialogPrimitive.Popup className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-background ring-1 ring-foreground/10 duration-150 data-open:animate-in data-open:slide-in-from-left-full data-closed:animate-out data-closed:slide-out-to-left-full">
          <DialogPrimitive.Title className="sr-only">
            Navigation
          </DialogPrimitive.Title>
          <div className="flex h-14 items-center gap-2 border-b px-4">
            <Link
              href="/"
              className="font-semibold tracking-tight text-sm"
              aria-label="peos home"
              onClick={() => setOpen(false)}
            >
              <PeosLogo withWordmark />
            </Link>
          </div>
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
            {nav.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center rounded-md px-3 py-2 text-sm",
                    active
                      ? "font-semibold text-foreground bg-muted"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}