import type { ReactNode } from "react";

import { PeosLogo } from "@/components/brand/peos-logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <PeosLogo
          withWordmark
          className="text-2xl"
          iconClassName="size-10"
        />
        {children}
      </div>
    </div>
  );
}