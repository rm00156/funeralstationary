/**
 * Bring another database's templates in line with this one: every template
 * that is new or different here is written there, with its category links
 * and every storage object its preview and layouts point at.
 *
 * copy-catalogue.ts is the one-shot bootstrap and refuses a target that
 * already has a catalogue. This is the follow-up: templates are authored and
 * published in the local admin, and a merge ships only code — the rows and
 * the images live in the database and bucket they were made in.
 *
 *   SOURCE_DATABASE_URL=mysql://root:@127.0.0.1:3306/funeralstationary \
 *   TARGET_DATABASE_URL=mysql://…tidbcloud.com:4000/funeralstationary \
 *   FROM_STORAGE_ORIGIN=https://myprintshopsaas.s3.eu-west-2.amazonaws.com \
 *   TO_STORAGE_ORIGIN=https://funeral-stationery-prod-eu-central-1.s3.eu-central-1.amazonaws.com \
 *   npx tsx scripts/sync-templates.ts                 # dry run: what would change
 *   npx tsx scripts/sync-templates.ts --only=a,b      # just these slugs
 *   npx tsx scripts/sync-templates.ts --apply         # copy objects, then write rows
 *
 * Templates are matched by slug, never by surrogate id — the two databases
 * mint ids independently — and their product and categories are resolved by
 * slug in the target, which must already have them. Templates that exist only
 * in the target are left alone. A template edited in the target since the
 * source last changed is skipped unless --force, so a prod admin edit isn't
 * silently reverted. Objects are copied with the default AWS credential chain
 * (the same credentials `aws s3` uses); deploy the code first, so the target
 * never serves a layout its code doesn't understand.
 */
import { execFileSync } from "node:child_process";

import { CopyObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type mysql from "mysql2/promise";

import { connect, rewriteValue } from "./copy-catalogue";

export interface TemplateRow {
  id: number;
  slug: string;
  name: string;
  productSlug: string;
  previewImageUrl: string;
  /** The admin's pinned stand-in portrait, or null — the thumbnail is drawn with it. */
  placeholderPortrait: string | null;
  layout: unknown;
  draftLayout: unknown;
  status: string;
  sortOrder: number;
  updatedAt: Date;
  /** Category slugs in position order. */
  categories: string[];
}

/** Stable JSON: two databases can hand back the same document with its keys in a different order. */
export function canonicalJson(value: unknown): string {
  const sort = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sort)
      : v !== null && typeof v === "object"
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map((k) => [k, sort((v as Record<string, unknown>)[k])]),
          )
        : v;
  return JSON.stringify(sort(value));
}

/** The source row as it should read in the target: storage URLs moved to the target bucket. */
function rewritten(row: TemplateRow, from: string, to: string) {
  const json = (v: unknown) => (v == null ? null : JSON.parse(rewriteValue(v, from, to) as string));
  return {
    ...row,
    previewImageUrl: rewriteValue(row.previewImageUrl, from, to) as string,
    layout: json(row.layout),
    draftLayout: json(row.draftLayout),
  };
}

/** Field names that differ between the rewritten source row and the target row. */
export function templateDiff(source: TemplateRow, target: TemplateRow, from: string, to: string): string[] {
  const want = rewritten(source, from, to);
  const diffs: string[] = [];
  for (const key of ["name", "productSlug", "previewImageUrl", "placeholderPortrait", "status", "sortOrder"] as const) {
    if (want[key] !== target[key]) diffs.push(key);
  }
  if (canonicalJson(want.layout) !== canonicalJson(target.layout ?? null)) diffs.push("layout");
  if (canonicalJson(want.draftLayout) !== canonicalJson(target.draftLayout ?? null)) diffs.push("draftLayout");
  if (want.categories.join(",") !== target.categories.join(",")) diffs.push("categories");
  return diffs;
}

export interface SyncPlan {
  create: TemplateRow[];
  update: { row: TemplateRow; diffs: string[] }[];
  /** Different, but the target copy changed more recently — skipped without --force. */
  targetNewer: { row: TemplateRow; diffs: string[] }[];
  unchanged: number;
  targetOnly: string[];
}

export function planTemplateSync(
  source: TemplateRow[],
  target: TemplateRow[],
  opts: { from: string; to: string; only?: string[]; force?: boolean },
): SyncPlan {
  const bySlug = new Map(target.map((row) => [row.slug, row]));
  const plan: SyncPlan = { create: [], update: [], targetNewer: [], unchanged: 0, targetOnly: [] };
  for (const row of source) {
    if (opts.only && !opts.only.includes(row.slug)) continue;
    const existing = bySlug.get(row.slug);
    if (!existing) {
      plan.create.push(row);
      continue;
    }
    const diffs = templateDiff(row, existing, opts.from, opts.to);
    if (diffs.length === 0) plan.unchanged++;
    else if (existing.updatedAt > row.updatedAt && !opts.force) plan.targetNewer.push({ row, diffs });
    else plan.update.push({ row, diffs });
  }
  const sourceSlugs = new Set(source.map((row) => row.slug));
  plan.targetOnly = target.filter((row) => !sourceSlugs.has(row.slug)).map((row) => row.slug);
  return plan;
}

/** Every URL in a row's preview and layouts, as found anywhere in the JSON. */
export function referencedUrls(row: Pick<TemplateRow, "previewImageUrl" | "layout" | "draftLayout">): string[] {
  const found = new Set<string>([row.previewImageUrl]);
  const walk = (v: unknown) => {
    if (typeof v === "string") {
      if (/^(https?:\/\/|\/)/.test(v)) found.add(v);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v !== null && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(row.layout);
  walk(row.draftLayout);
  return [...found];
}

/** `https://<bucket>.s3.<region>.amazonaws.com` → its bucket and region. */
export function parseS3Origin(origin: string): { bucket: string; region: string } {
  const match = /^https:\/\/([^.]+)\.s3\.([a-z0-9-]+)\.amazonaws\.com$/.exec(origin);
  if (!match) throw new Error(`${origin} is not an https://<bucket>.s3.<region>.amazonaws.com origin`);
  return { bucket: match[1], region: match[2] };
}

const TEMPLATE_QUERY = `
  select t.id, t.slug, t.name, p.slug productSlug, t.preview_image_url previewImageUrl,
         t.placeholder_portrait placeholderPortrait,
         t.layout, t.draft_layout draftLayout, t.status, t.sort_order sortOrder, t.updated_at updatedAt,
         (select group_concat(c.slug order by l.position separator ',')
            from template_category_links l join template_categories c on c.id = l.category_id
           where l.template_id = t.id) categoryList
    from templates t join products p on p.id = t.product_id
   order by t.sort_order, t.id`;

async function loadTemplates(conn: mysql.Connection): Promise<TemplateRow[]> {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(TEMPLATE_QUERY);
  return rows.map(({ categoryList, ...row }) => ({
    ...(row as Omit<TemplateRow, "categories">),
    categories: categoryList ? String(categoryList).split(",") : [],
  }));
}

async function slugIds(conn: mysql.Connection, table: string): Promise<Map<string, number>> {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(`select id, slug from \`${table}\``);
  return new Map(rows.map((row) => [row.slug as string, row.id as number]));
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — see the usage at the top of scripts/sync-templates.ts`);
  return value.replace(/\/+$/, "");
}

async function objectExists(s3: S3Client, bucket: string, key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (err) {
    if ((err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return false;
    throw err;
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const force = process.argv.includes("--force");
  const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
  const only = onlyArg ? onlyArg.slice("--only=".length).split(",").filter(Boolean) : undefined;
  const sourceUrl = requireEnv("SOURCE_DATABASE_URL");
  const targetUrl = requireEnv("TARGET_DATABASE_URL");
  const from = requireEnv("FROM_STORAGE_ORIGIN");
  const to = requireEnv("TO_STORAGE_ORIGIN");
  if (sourceUrl === targetUrl) throw new Error("SOURCE_DATABASE_URL and TARGET_DATABASE_URL are the same database");
  const fromBucket = parseS3Origin(from);
  const toBucket = parseS3Origin(to);

  const source = await connect(sourceUrl);
  const target = await connect(targetUrl);
  try {
    const plan = planTemplateSync(await loadTemplates(source), await loadTemplates(target), { from, to, only, force });
    const writes = [...plan.create, ...plan.update.map((u) => u.row)];

    for (const row of plan.create) console.log(`+ ${row.slug} [${row.status}] — new`);
    for (const { row, diffs } of plan.update) console.log(`~ ${row.slug} [${row.status}] — ${diffs.join(", ")}`);
    for (const { row, diffs } of plan.targetNewer) {
      console.log(`! ${row.slug} — ${diffs.join(", ")} differ, but the target was edited more recently; skipped (--force to overwrite)`);
    }
    console.log(`${plan.unchanged} unchanged${plan.targetOnly.length ? `; only in target, left alone: ${plan.targetOnly.join(", ")}` : ""}`);
    if (only) {
      const unknown = only.filter((slug) => !writes.some((r) => r.slug === slug) && !plan.targetNewer.some((t) => t.row.slug === slug));
      if (unknown.length) console.log(`(nothing to do for: ${unknown.join(", ")})`);
    }
    if (writes.length === 0) return;

    // The target must already hold every product and category the rows point at.
    const products = await slugIds(target, "products");
    const categories = await slugIds(target, "template_categories");
    const missing = new Set<string>();
    for (const row of writes) {
      if (!products.has(row.productSlug)) missing.add(`product ${row.productSlug}`);
      for (const slug of row.categories) if (!categories.has(slug)) missing.add(`category ${slug}`);
    }
    if (missing.size) throw new Error(`target is missing ${[...missing].join(", ")} — create them in its /admin first`);

    // Storage: bucket objects get copied; site-relative paths must be committed
    // files, since public/templates/backgrounds and friends are gitignored.
    const keys = new Set<string>();
    const tracked = new Set(execFileSync("git", ["ls-files", "public"], { encoding: "utf8" }).split("\n"));
    const problems: string[] = [];
    for (const row of writes) {
      for (const url of referencedUrls(row)) {
        if (url.startsWith(`${from}/`)) keys.add(url.slice(from.length + 1));
        else if (url.startsWith("/") && !tracked.has(`public${url}`)) problems.push(`${row.slug}: ${url} is not a committed file in public/`);
        else if (!url.startsWith("/") && !url.startsWith(`${to}/`)) problems.push(`${row.slug}: ${url} is in neither bucket`);
      }
    }
    if (problems.length) throw new Error(`unservable URLs:\n  ${problems.join("\n  ")}`);

    const s3 = new S3Client({ region: toBucket.region });
    const toCopy: string[] = [];
    for (const key of keys) if (!(await objectExists(s3, toBucket.bucket, key))) toCopy.push(key);
    console.log(`\n${keys.size} storage objects referenced, ${toCopy.length} missing from ${toBucket.bucket}`);

    if (!apply) {
      console.log("\nDry run — nothing written. Re-run with --apply to sync.");
      return;
    }

    // Objects first: a row pointing at a missing image is visible breakage,
    // an object no row points at yet is harmless.
    for (const key of toCopy) {
      await s3.send(
        new CopyObjectCommand({
          Bucket: toBucket.bucket,
          Key: key,
          CopySource: `${fromBucket.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`,
        }),
      );
      console.log(`copied ${key}`);
    }

    await target.beginTransaction();
    try {
      const existingIds = await slugIds(target, "templates");
      for (const row of writes) {
        const want = rewritten(row, from, to);
        const values = {
          name: want.name,
          product_id: products.get(want.productSlug)!,
          preview_image_url: want.previewImageUrl,
          placeholder_portrait: want.placeholderPortrait,
          layout: want.layout == null ? null : JSON.stringify(want.layout),
          draft_layout: want.draftLayout == null ? null : JSON.stringify(want.draftLayout),
          status: want.status,
          sort_order: want.sortOrder,
        };
        let templateId = existingIds.get(row.slug);
        if (templateId === undefined) {
          const [result] = await target.query<mysql.ResultSetHeader>("insert into templates set ?", [
            { slug: row.slug, ...values },
          ]);
          templateId = result.insertId;
        } else {
          await target.query("update templates set ? where id = ?", [values, templateId]);
        }
        // Delete-then-insert, like seed.ts, so a shrunk category list drops its stale links.
        await target.query("delete from template_category_links where template_id = ?", [templateId]);
        if (want.categories.length) {
          await target.query("insert into template_category_links (template_id, category_id, position) values ?", [
            want.categories.map((slug, position) => [templateId, categories.get(slug)!, position]),
          ]);
        }
      }
      await target.commit();
    } catch (err) {
      await target.rollback();
      throw err;
    }
    console.log(`\nSynced ${writes.length} templates.`);
  } finally {
    await source.end();
    await target.end();
  }
}

if (process.argv[1] && process.argv[1].includes("sync-templates")) {
  main().catch((err) => {
    console.error("[sync-templates] failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
