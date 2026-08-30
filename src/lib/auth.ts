import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  // Resolved per-request from the Host header — no URL to configure before
  // or after deploy, works on every Vercel preview URL and prod as-is.
  // Set PROD_DOMAIN in the environment to your real domain (e.g. example.com).
  baseURL: {
    allowedHosts: [
      "localhost:3000",
      "*.vercel.app",
      ...(process.env.PROD_DOMAIN
        ? [process.env.PROD_DOMAIN, `*.${process.env.PROD_DOMAIN}`]
        : []),
    ],
    fallback: process.env.PROD_DOMAIN ? `https://${process.env.PROD_DOMAIN}` : undefined,
  },
  database: drizzleAdapter(db, {

    provider: "pg",
    schema: {
      ...schema,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh sliding session daily
  },

  plugins: [nextCookies()],
  advanced: {
    cookiePrefix: "peos",
  },
});

export type Session = typeof auth.$Infer.Session;
