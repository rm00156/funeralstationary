import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

type Database = MySql2Database<typeof schema>;

declare global {
  var __dbPool: mysql.Pool | undefined;
  var __db: Database | undefined;
}

function createDb(): Database {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set — copy .env.example to .env and adjust it.");
  }
  // Reuse the pool across Next.js dev-server hot reloads instead of leaking connections.
  if (!globalThis.__dbPool) {
    const url = process.env.DATABASE_URL;
    // TiDB Cloud (production) refuses plaintext connections; local MySQL has
    // no certificate, so TLS is switched on by host rather than always.
    const ssl = new URL(url).hostname.endsWith(".tidbcloud.com")
      ? { minVersion: "TLSv1.2" as const }
      : undefined;
    globalThis.__dbPool = mysql.createPool({ uri: url, ssl });
  }
  return drizzle(globalThis.__dbPool, { schema, mode: "default" });
}

function getDb(): Database {
  if (!globalThis.__db) globalThis.__db = createDb();
  return globalThis.__db;
}

/**
 * Lazily-initialised Drizzle client.
 *
 * The connection is built on first *use*, not on import: `next build` imports
 * every Route Handler to read its config exports, so constructing the pool at
 * module scope would make a database a build-time requirement and break CI,
 * where no DATABASE_URL exists. Call sites still just use `db.select(...)`.
 */
export const db = new Proxy({} as Database, {
  get(_target, property) {
    const instance = getDb();
    const value = Reflect.get(instance, property) as unknown;
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export * as schema from "./schema";
