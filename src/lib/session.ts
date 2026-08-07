import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

/**
 * Server-side session lookup, memoized per render pass via React cache().
 * Returns null when signed out (does not redirect) — callers decide.
 */
export const getSession = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
});

/**
 * Requires a valid session, redirecting to /login otherwise.
 * Use in server components / route handlers / server actions.
 */
export const requireSession = cache(async () => {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
});