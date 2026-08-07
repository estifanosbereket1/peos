import Link from "next/link";
import type { ReactNode } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { NavLinks } from "@/components/nav/nav-links";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { requireSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <nav className="mx-auto flex max-w-5xl items-center gap-4 px-4 h-14">
          <Link
            href="/"
            className="font-semibold tracking-tight text-sm"
          >
            peos
          </Link>
          <NavLinks />
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {session.user.name}
            </span>
            <SignOutButton />
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}