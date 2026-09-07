/**
 * Bulk template generator (`npm run templates:generate`).
 *
 * Turns the curated specs in src/lib/templateGenerator.ts into real catalogue
 * rows: one templates row per spec, its cover/middle/back layout published,
 * and a preview thumbnail rendered from the cover.
 *
 * Deliberately creates everything with `status: "draft"` — the layout is live
 * on the row but the template stays invisible to customers until a human
 * reviews it and flips the status in /admin/templates. The two gates are
 * independent (see CLAUDE.md), and bulk-generated artwork is exactly the case
 * the status gate exists for.
 *
 * Thumbnails reuse the same /proof-render screenshot path as the admin
 * publish flow, so they need a running server: start `npm run dev` first, or
 * pass --origin, or skip them with --no-thumbnails.
 *
 * Specs with a `background` need their rendered artwork to exist first
 * (`npm run backgrounds:fetch`); without S3 that's checked on disk and the
 * spec is skipped with a warning rather than generated over a broken image.
 *
 * Usage:
 *   npm run templates:generate -- [--origin=http://localhost:3000]
 *                                 [--product=order-of-service]
 *                                 [--only=slug,slug] [--force] [--no-thumbnails]
 */

import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  adminCreateTemplate,
  adminGetTemplate,
  adminListTemplates,
  adminPublishTemplateLayout,
  adminSaveTemplateDraftLayout,
  adminUpdateTemplate,
} from "@/lib/adminCatalogue.server";
import { backgroundAssetExists, backgroundAssetUrl } from "@/lib/backgroundAssets.server";
import { isStorageConfigured, uploadObject } from "@/lib/storage";
import { renderTemplateThumbnail } from "@/lib/templateThumbnail.server";
import { TEMPLATE_SPECS, buildTemplateLayout, type TemplateSpec } from "@/lib/templateGenerator";

/** Shipped asset, used until a real thumbnail lands so preview_image_url is never a 404. */
const PLACEHOLDER_PREVIEW = "/fs-monogram.webp";

function flag(name: string): string | undefined {
  const match = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return match?.slice(name.length + 3);
}

const has = (name: string) => process.argv.includes(`--${name}`);

const origin = flag("origin") ?? "http://localhost:3000";
const productSlug = flag("product") ?? "order-of-service";
const only = flag("only")?.split(",").map((entry) => entry.trim()).filter(Boolean);
const force = has("force");
const thumbnails = !has("no-thumbnails");

/**
 * Persist a rendered thumbnail. Object storage when it's configured (the same
 * place the admin publish flow puts them), otherwise a file under public/ so
 * the script is still usable in development without S3.
 */
async function saveThumbnail(slug: string, png: Buffer): Promise<string> {
  if (isStorageConfigured()) {
    return uploadObject(`template-previews/${slug}-${Date.now()}.png`, png, "image/png");
  }
  const dir = path.join(process.cwd(), "public", "templates", slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "cover.png"), png);
  return `/templates/${slug}/cover.png`;
}

async function generate(spec: TemplateSpec, sortOrder: number) {
  const existing = await adminGetTemplate(spec.slug);
  if (existing && !force) return { slug: spec.slug, outcome: "skipped" as const };

  let backgroundUrl: string | undefined;
  if (spec.background) {
    if (!isStorageConfigured() && !(await backgroundAssetExists(spec.background, spec.palette))) {
      return { slug: spec.slug, outcome: "no-background" as const };
    }
    backgroundUrl = backgroundAssetUrl(spec.background, spec.palette);
  }
  const pages = buildTemplateLayout(spec, { backgroundUrl });

  if (existing) {
    await adminUpdateTemplate(spec.slug, {
      name: spec.name,
      productSlug,
      categories: spec.categories,
    });
  } else {
    await adminCreateTemplate({
      slug: spec.slug,
      name: spec.name,
      productSlug,
      previewImageUrl: PLACEHOLDER_PREVIEW,
      status: "draft",
      sortOrder,
      categories: spec.categories,
    });
  }

  // Go through the normal draft→publish seam rather than writing `layout`
  // directly, so generated rows end up in exactly the state the authoring
  // editor would leave them in: layout set, no dangling draft.
  await adminSaveTemplateDraftLayout(spec.slug, pages);
  const published = await adminPublishTemplateLayout(spec.slug);
  if (published.status !== "published") {
    throw new Error(`Could not publish layout for "${spec.slug}" (${published.status})`);
  }

  if (!thumbnails) return { slug: spec.slug, outcome: "created" as const, thumbnail: false };

  // Best-effort, matching the admin publish route: a thumbnail failure leaves
  // a usable template rather than aborting the whole run.
  try {
    const png = await renderTemplateThumbnail(origin, pages[0]);
    const url = await saveThumbnail(spec.slug, png);
    await adminUpdateTemplate(spec.slug, { previewImageUrl: url });
    return { slug: spec.slug, outcome: "created" as const, thumbnail: true };
  } catch (error) {
    console.warn(`  ! thumbnail failed for "${spec.slug}": ${(error as Error).message}`);
    return { slug: spec.slug, outcome: "created" as const, thumbnail: false };
  }
}

async function main() {
  const specs = only
    ? TEMPLATE_SPECS.filter((spec) => only.includes(spec.slug))
    : TEMPLATE_SPECS;

  if (specs.length === 0) {
    console.error(only ? `No specs matched --only=${only.join(",")}` : "No specs to generate");
    process.exitCode = 1;
    return;
  }

  const current = await adminListTemplates();
  let nextSortOrder = current.reduce((max, entry) => Math.max(max, entry.sortOrder), -1) + 1;

  console.log(
    `Generating ${specs.length} template(s) for "${productSlug}" as drafts` +
      (thumbnails ? ` (thumbnails via ${origin})` : " (thumbnails skipped)"),
  );
  if (thumbnails && !isStorageConfigured()) {
    console.log("S3 is not configured — writing thumbnails to public/templates/<slug>/cover.png");
  }

  const results = [];
  for (const spec of specs) {
    const result = await generate(spec, nextSortOrder);
    if (result.outcome === "created") nextSortOrder += 1;
    console.log(
      result.outcome === "skipped"
        ? `  - ${spec.slug} (already exists — pass --force to rebuild)`
        : result.outcome === "no-background"
          ? `  ! ${spec.slug} skipped — background "${spec.background}/${spec.palette}" not rendered (run npm run backgrounds:fetch)`
          : `  ✓ ${spec.slug}${result.thumbnail ? "" : " (no thumbnail)"}`,
    );
    results.push(result);
  }

  const created = results.filter((entry) => entry.outcome === "created").length;
  const skipped = results.length - created;
  console.log(
    `\nDone: ${created} generated, ${skipped} skipped. ` +
      `All are status="draft" — review them in /admin/templates and publish the ones you want live.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
