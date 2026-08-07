import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

// Singleton guard: in dev, module reloads would otherwise create fresh
// connections on every hot reload. Cache the drizzle instance on globalThis.
const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof createDb> | undefined;
};

function createDb() {
  // prepare:false is required when connecting via a pooled URL (Neon
  // PgBouncer transaction mode). Harmless against a local server.
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  return drizzle(client, { schema });
}

export const db = globalForDb.db ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}

export type Database = typeof db;
export { schema };