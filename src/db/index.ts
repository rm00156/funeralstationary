import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

declare global {
  var __dbPool: mysql.Pool | undefined;
}

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set — copy .env.example to .env and adjust it.");
  }
  // Reuse the pool across Next.js dev-server hot reloads instead of leaking connections.
  if (!globalThis.__dbPool) {
    globalThis.__dbPool = mysql.createPool(process.env.DATABASE_URL);
  }
  return globalThis.__dbPool;
}

export const db = drizzle(getPool(), { schema, mode: "default" });
export * as schema from "./schema";
