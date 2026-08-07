"use client";

import { useEffect } from "react";

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
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // offline shell is a progressive enhancement — ignore failures.
    });
  }, []);

  return null;
}