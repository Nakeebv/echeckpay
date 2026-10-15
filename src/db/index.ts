import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * Connection source:
 *  - Cloudflare Workers: the HYPERDRIVE binding (see wrangler.jsonc).
 *  - Local dev / build: DATABASE_URL from .env.
 */
function resolveConnectionString(): string {
  try {
    const { getCloudflareContext } =
      require("@opennextjs/cloudflare") as typeof import("@opennextjs/cloudflare");
    const env = getCloudflareContext().env as
      | { HYPERDRIVE?: { connectionString?: string } }
      | undefined;
    if (env?.HYPERDRIVE?.connectionString) {
      return env.HYPERDRIVE.connectionString;
    }
  } catch {
    // Not running inside a Workers request — fall through to DATABASE_URL.
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  return databaseUrl;
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: resolveConnectionString(),
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
