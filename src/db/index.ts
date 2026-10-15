import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";

/**
 * Connection source:
 *  - Cloudflare Workers: DATABASE_URL secret (e.g. a Supabase session pooler)
 *    — or the HYPERDRIVE binding if one is attached (see wrangler.jsonc).
 *  - Local dev / build: DATABASE_URL from .env (e.g. a local Postgres, no SSL).
 *
 * Workers runtime constraints: I/O objects (sockets) created inside one
 * request may not be used by another, so long-lived pools/clients are not
 * viable. Every query chain therefore gets its own short-lived connection,
 * opened lazily on first use and closed when the chain settles.
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

const databaseUrl = resolveConnectionString();
const isLocalDatabase = /localhost|127\.0\.0\.1/.test(databaseUrl);

type DrizzleDb = NodePgDatabase<Record<string, never>>;

const TERMINAL_PROPS = new Set(["then", "catch", "finally", "execute", "all"]);

function newClient(): pg.Client {
  return new pg.Client({
    connectionString: databaseUrl,
    // Supabase requires SSL; the sslmode in the URL controls verification.
    // A localhost dev URL carries no sslmode, so it connects unencrypted.
    ssl: isLocalDatabase ? undefined : { rejectUnauthorized: false },
    statement_timeout: 10_000,
    query_timeout: 15_000,
  });
}

async function closeClient(client: pg.Client): Promise<void> {
  try {
    await Promise.resolve(client.end());
  } catch {
    /* connection may already be gone */
  }
}

/** Wrap a drizzle builder so its terminal await closes the connection. */
function wrapChainable(value: unknown, client: pg.Client): unknown {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) {
    return value;
  }
  return new Proxy(value as object, {
    get(obj, prop, recv) {
      if (typeof prop === "string" && TERMINAL_PROPS.has(prop)) {
        const orig = Reflect.get(obj, prop, recv);
        if (typeof orig === "function") {
          return async (...args: unknown[]) => {
            try {
              return await (orig as (...a: unknown[]) => unknown).apply(obj, args);
            } finally {
              void closeClient(client);
            }
          };
        }
      }
      const next = Reflect.get(obj, prop, recv);
      if (typeof next === "function") {
        return (...callArgs: unknown[]) => wrapChainable(next.apply(obj, callArgs), client);
      }
      return wrapChainable(next, client);
    },
  });
}

/** Drizzle instance over a fresh client; every method call opens a connection. */
function makeDbProxy(): DrizzleDb {
  return new Proxy({} as DrizzleDb, {
    get(_target, prop) {
      if (typeof prop !== "string") return undefined;
      return (...args: unknown[]) => {
        const client = newClient();
        const connected = client.connect();
        const instance = drizzle(client);
        const value = Reflect.get(instance as object, prop).apply(instance, args);
        if (value && typeof (value as { then?: unknown }).then === "function") {
          // promise-returning methods (execute / transaction / ...returning())
          return (async () => {
            await connected;
            try {
              return await value;
            } finally {
              void closeClient(client);
            }
          })();
        }
        // query builder — close the connection once the chain settles
        return wrapChainable(value, client);
      };
    },
  });
}

export const db: DrizzleDb = makeDbProxy();
