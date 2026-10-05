/**
 * Copy the catalogue — products, template categories, templates and the four
 * pricing tables — from one database into another, rewriting object-storage
 * URLs on the way.
 *
 * This is how production gets its first catalogue. `db:seed` only bootstraps
 * the hardcoded seed rows; the real library (generated templates, admin-
 * authored layouts, published/draft statuses, admin price edits) lives in the
 * database it was built in. Template layouts and preview images hold
 * ABSOLUTE storage URLs, so moving to another bucket means rewriting them
 * (copy the objects across first — this script moves rows, not bytes).
 *
 *   SOURCE_DATABASE_URL=mysql://root:@127.0.0.1:3306/funeralstationary \
 *   TARGET_DATABASE_URL=mysql://…tidbcloud.com:4000/funeralstationary \
 *   FROM_STORAGE_ORIGIN=https://myprintshopsaas.s3.eu-west-2.amazonaws.com \
 *   TO_STORAGE_ORIGIN=https://funeral-stationery-prod-eu-central-1.s3.eu-central-1.amazonaws.com \
 *   npx tsx scripts/copy-catalogue.ts            # dry run: counts + leftover URLs
 *   npx tsx scripts/copy-catalogue.ts --apply    # write, in one transaction
 *
 * The target must already be migrated and must have NO products: this is a
 * one-shot bootstrap, not a sync, and it refuses to merge into a catalogue
 * that admin edits may already have made authoritative. Surrogate ids are
 * copied as-is so every FK between the copied tables still lines up.
 */
import mysql from "mysql2/promise";

/** FK order: every table's parents come before it. */
export const CATALOGUE_TABLES = [
  "products",
  "template_categories",
  "templates",
  "template_category_links",
  "paper_options",
  "quantity_options",
  "page_count_options",
  "delivery_options",
] as const;

/**
 * One column value, ready to insert, with every `from` origin swapped for
 * `to`. JSON columns arrive from mysql2 already parsed, so they go back out
 * as a JSON string (MySQL casts it into the column); `from` is matched with
 * its trailing slash so `…/bucket` can't also rewrite `…/bucket-other`.
 */
export function rewriteValue(value: unknown, from: string, to: string): unknown {
  const swap = (s: string) => s.split(`${from}/`).join(`${to}/`);
  if (typeof value === "string") return swap(value);
  if (value !== null && typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    return swap(JSON.stringify(value));
  }
  return value;
}

export function connect(url: string) {
  // TiDB Cloud refuses plaintext; local MySQL has no certificate.
  const ssl = new URL(url).hostname.endsWith(".tidbcloud.com")
    ? { minVersion: "TLSv1.2" as const }
    : undefined;
  return mysql.createConnection({ uri: url, ssl });
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — see the usage at the top of scripts/copy-catalogue.ts`);
  return value.replace(/\/+$/, "");
}

async function main() {
  const apply = process.argv.includes("--apply");
  const sourceUrl = requireEnv("SOURCE_DATABASE_URL");
  const targetUrl = requireEnv("TARGET_DATABASE_URL");
  const from = requireEnv("FROM_STORAGE_ORIGIN");
  const to = requireEnv("TO_STORAGE_ORIGIN");
  if (sourceUrl === targetUrl) throw new Error("SOURCE_DATABASE_URL and TARGET_DATABASE_URL are the same database");

  const source = await connect(sourceUrl);
  const target = await connect(targetUrl);
  try {
    const [[{ n }]] = await target.query<mysql.RowDataPacket[]>("select count(*) n from products");
    if (Number(n) > 0) {
      throw new Error(`target already has ${n} products — refusing to copy over an existing catalogue`);
    }

    const copies: { table: string; columns: string[]; rows: unknown[][] }[] = [];
    for (const table of CATALOGUE_TABLES) {
      const [rows, fields] = await source.query<mysql.RowDataPacket[]>(`select * from \`${table}\``);
      const columns = fields.map((f) => f.name);
      copies.push({
        table,
        columns,
        rows: rows.map((row) => columns.map((c) => rewriteValue(row[c], from, to))),
      });
    }

    let leftovers = 0;
    for (const { table, rows } of copies) {
      const stale = rows.filter((r) => r.some((v) => typeof v === "string" && v.includes(from))).length;
      leftovers += stale;
      console.log(`${table}: ${rows.length} rows${stale ? ` (${stale} still mention ${from})` : ""}`);
    }
    if (leftovers) {
      // The trailing-slash match means an origin written without a path
      // wouldn't be rewritten; better to stop than ship half-moved URLs.
      throw new Error(`${leftovers} rows would still reference ${from} after rewriting`);
    }

    if (!apply) {
      console.log("\nDry run — nothing written. Re-run with --apply to copy.");
      return;
    }

    await target.beginTransaction();
    try {
      for (const { table, columns, rows } of copies) {
        if (rows.length === 0) continue;
        const cols = columns.map((c) => `\`${c}\``).join(", ");
        await target.query(`insert into \`${table}\` (${cols}) values ?`, [rows]);
      }
      await target.commit();
    } catch (err) {
      await target.rollback();
      throw err;
    }
    console.log("\nCopied. The target's db:seed will now leave this catalogue alone.");
  } finally {
    await source.end();
    await target.end();
  }
}

if (process.argv[1] && process.argv[1].includes("copy-catalogue")) {
  main().catch((err) => {
    console.error("[copy-catalogue] failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
