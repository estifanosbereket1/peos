import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  secret: "85577ed97c8472c8624bccecccdabc2c250e4e04685a4cd16a696f2f47f03a94",
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
