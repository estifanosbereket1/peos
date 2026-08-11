"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/components/pwa/use-install-prompt";

/** Shows an "Install app" button while Chrome's install prompt is available. */
export function InstallButton() {
  const deferred = useInstallPrompt();

  if (!deferred) return null;

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Install app"
      title="Install app"
      onClick={() => {
        void deferred.prompt();
        void deferred.userChoice.finally(() => {});
      }}
    >
      <Download />
    </Button>
  );
}