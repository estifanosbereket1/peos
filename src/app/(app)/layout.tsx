import Link from "next/link";
import type { ReactNode } from "react";

import { PeosLogo } from "@/components/brand/peos-logo";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { MobileNav } from "@/components/nav/mobile-nav";
import { NavLinks } from "@/components/nav/nav-links";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { requireSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 md:h-14 md:py-0">
          <Link
            href="/"
            className="font-semibold tracking-tight text-sm"
            aria-label="peos home"
          >
            <PeosLogo withWordmark />
          </Link>
          <div className="hidden min-w-0 flex-1 overflow-x-auto md:block">
            <NavLinks />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <ThemeToggle />
            <span className="hidden text-sm text-muted-foreground lg:inline">
              {session.user.name}
            </span>
            <SignOutButton />
          </div>
          <MobileNav />
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}