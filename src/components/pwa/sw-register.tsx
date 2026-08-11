"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/** Registers the PWA service worker in production only. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker.register("/sw.js").then((registration) => {
      if (!registration.active) return;
      registration.update().catch(() => {});
      registration.addEventListener("updatefound", () => {
        const next = registration.installing;
        if (!next) return;
        next.addEventListener("statechange", () => {
          if (next.state === "installed" && navigator.serviceWorker.controller) {
            toast("Update available", {
              description: "A new version is ready. Reload to update.",
              action: {
                label: "Reload",
                onClick: () => {
                  next.postMessage("SKIP_WAITING");
                },
              },
            });
          }
        });
      });
    }).catch(() => {
      // offline shell is a progressive enhancement — ignore failures.
    });
  }, []);

  return null;
}