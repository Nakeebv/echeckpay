import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";

/**
 * Connection source:
 *  - Cloudflare Workers: DATABASE_URL secret (e.g. a Supabase session pooler)
 *    — or the HYPERDRIVE binding if one is attached (see wrangler.jsonc).
 *  - Local dev / build: DATABASE_URL from .env (e.g. a local Postgres, no SSL).
 *
 * Workers runtime constraints: I/O objects (sockets) created inside one
 * request may not be used by another, so long-lived pools are not viable.
 * What IS safe is reusing sockets for the whole lifetime of a single request.
 * That matters a lot: a fresh TCP + auth handshake to the database costs many
 * times a single query. Each request therefore keeps a small pool of
 * connections (so parallel queries stay parallel) and closes them a moment
 * after the request's last query settles.
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

/* ------------------------------------------------------------------ */
/* per-request connection pool                                         */
/* ------------------------------------------------------------------ */

type RequestContext = {
  ctx?: { waitUntil?: (promise: Promise<unknown>) => void };
};

type RequestConn = {
  client: pg.Client;
  connected: Promise<unknown>;
  inflight: number;
  idleTimer: ReturnType<typeof setTimeout> | null;
  lifetimeTimer: ReturnType<typeof setTimeout> | null;
  closed: boolean;
  resolveDone: () => void;
  done: Promise<void>;
  pool: RequestConn[] | null;
  poolKey: object | null;
};

const requestPools = new Map<object, RequestConn[]>();
const MAX_PER_REQUEST = 4; // keeps parallel reads parallel without opening a socket per query
const MAX_POOLS = 64; // cap so an isolate can never accumulate requests' pools
const IDLE_CLOSE_MS = 300; // close a connection once a request stops querying
const MAX_CONN_LIFETIME_MS = 20_000; // absolute safety cap

function requestContext(): RequestContext | null {
  try {
    const { getCloudflareContext } =
      require("@opennextjs/cloudflare") as typeof import("@opennextjs/cloudflare");
    return getCloudflareContext() as unknown as RequestContext;
  } catch {
    return null;
  }
}

function dropConn(conn: RequestConn): void {
  conn.closed = true;
  if (conn.idleTimer) clearTimeout(conn.idleTimer);
  if (conn.lifetimeTimer) clearTimeout(conn.lifetimeTimer);
  if (conn.pool) {
    const idx = conn.pool.indexOf(conn);
    if (idx >= 0) conn.pool.splice(idx, 1);
  }
  if (conn.poolKey) {
    const pool = requestPools.get(conn.poolKey);
    if (pool && pool.length === 0) requestPools.delete(conn.poolKey);
  }
  void closeClient(conn.client).finally(conn.resolveDone);
}

function prunePools(): void {
  if (requestPools.size < MAX_POOLS) return;
  for (const [key, pool] of requestPools) {
    if (pool.every((c) => c.inflight === 0)) {
      for (const conn of [...pool]) dropConn(conn);
      requestPools.delete(key);
    }
    if (requestPools.size < MAX_POOLS) break;
  }
}

function createConn(
  pool: RequestConn[] | null,
  poolKey: object | null,
  waitUntil?: (p: Promise<unknown>) => void,
): RequestConn {
  const client = newClient();
  const connected = client.connect();
  connected.catch(() => {});
  let resolveDone: () => void = () => {};
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });
  const conn: RequestConn = {
    client,
    connected,
    inflight: 1,
    idleTimer: null,
    lifetimeTimer: null,
    closed: false,
    resolveDone,
    done,
    pool,
    poolKey,
  };
  conn.lifetimeTimer = setTimeout(() => {
    if (conn.inflight === 0) dropConn(conn);
  }, MAX_CONN_LIFETIME_MS);
  if (pool) pool.push(conn);
  // Keep the request's I/O context alive until cleanup runs, so closing the
  // socket is always permitted (even if the response already finished).
  if (waitUntil) {
    try {
      waitUntil(conn.done.catch(() => {}));
    } catch {
      /* waitUntil unavailable — idle timer still closes the socket */
    }
  }
  return conn;
}

function acquireConn(): RequestConn {
  const cf = requestContext();
  const key = cf?.ctx && typeof cf.ctx === "object" ? (cf.ctx as object) : null;

  if (!key) {
    // No request context (build / plain node dev): a short-lived connection.
    return createConn(null, null);
  }

  let pool = requestPools.get(key);
  if (!pool) {
    prunePools();
    pool = [];
    requestPools.set(key, pool);
  }

  // Prefer an idle, open connection so its handshake is amortised.
  let conn = pool.find((c) => !c.closed && c.inflight === 0);
  if (!conn) {
    if (pool.length < MAX_PER_REQUEST) {
      conn = createConn(pool, key, cf?.ctx?.waitUntil);
    } else {
      // All busy — queue on the least-loaded one (pg serialises per socket).
      conn = pool.reduce((a, b) => (b.inflight < a.inflight ? b : a));
      conn.inflight += 1;
    }
  } else {
    conn.inflight += 1;
  }
  if (conn.idleTimer) {
    clearTimeout(conn.idleTimer);
    conn.idleTimer = null;
  }
  return conn;
}

function releaseConn(conn: RequestConn): void {
  conn.inflight = Math.max(0, conn.inflight - 1);
  if (conn.inflight > 0 || conn.closed) return;
  if (conn.idleTimer) clearTimeout(conn.idleTimer);
  conn.idleTimer = setTimeout(() => {
    if (conn.inflight > 0 || conn.closed) return;
    dropConn(conn);
  }, IDLE_CLOSE_MS);
}

/* ------------------------------------------------------------------ */
/* drizzle proxy over request connections                              */
/* ------------------------------------------------------------------ */

const TERMINAL_PROPS = new Set(["then", "catch", "finally", "execute", "all"]);

/** Wrap a drizzle builder so its terminal await releases the connection. */
function wrapChainable(value: unknown, conn: RequestConn): unknown {
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
              await conn.connected;
              return await (orig as (...a: unknown[]) => unknown).apply(obj, args);
            } finally {
              releaseConn(conn);
            }
          };
        }
      }
      const next = Reflect.get(obj, prop, recv);
      if (typeof next === "function") {
        return (...callArgs: unknown[]) => wrapChainable(next.apply(obj, callArgs), conn);
      }
      return wrapChainable(next, conn);
    },
  });
}

function makeDbProxy(): DrizzleDb {
  return new Proxy({} as DrizzleDb, {
    get(_target, prop) {
      if (typeof prop !== "string") return undefined;
      return (...args: unknown[]) => {
        const conn = acquireConn();
        const instance = drizzle(conn.client);
        const value = Reflect.get(instance as object, prop).apply(instance, args);
        if (value && typeof (value as { then?: unknown }).then === "function") {
          // promise-returning methods (execute / transaction / ...returning())
          return (async () => {
            try {
              await conn.connected;
              return await value;
            } finally {
              releaseConn(conn);
            }
          })();
        }
        // query builder — release the connection once the chain settles
        return wrapChainable(value, conn);
      };
    },
  });
}

export const db: DrizzleDb = makeDbProxy();
