/**
 * Bulk template generator (`npm run templates:generate`).
 *
 * Turns the curated specs in src/lib/templateGenerator.ts (booklets) and
 * src/lib/flatTemplates.ts (cards, bookmarks, the memory board) into real
 * catalogue rows: one templates row per spec, its layout published, and a
 * preview thumbnail rendered from the first page at its product's trim.
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
 * Booklet specs go to --product (order-of-service by default), which must be
 * an A5 booklet; each flat spec goes to its own product. With no --product
 * both run; --product=<flat product> runs only that product's flat specs.
 *
 * Usage:
 *   npm run templates:generate -- [--origin=http://localhost:3000]
 *                                 [--product=order-of-service]
 *                                 [--only=slug,slug] [--force] [--no-thumbnails]
 */

import "dotenv/config";
import {
  adminCreateTemplate,
  adminGetProduct,
  adminGetTemplate,
  adminListTemplates,
  adminPublishTemplateLayout,
  adminSaveTemplateDraftLayout,
  adminUpdateTemplate,
} from "@/lib/adminCatalogue.server";
import {
  backgroundAssetExists,
  backgroundAssetUrl,
  sprayAssetUrl,
} from "@/lib/backgroundAssets.server";
import { isStorageConfigured } from "@/lib/storage";
import { renderTemplateThumbnail, saveTemplateThumbnail } from "@/lib/templateThumbnail.server";
import {
  A5_TRIM,
  sameTrim,
  toProductFormat,
  type DesignPage,
  type PageTrim,
} from "@/lib/designEditor";
import {
  FLAT_PRODUCTS,
  FLAT_TEMPLATE_SPECS,
  buildFlatTemplateLayout,
  flatBackgroundFormat,
  flatSpecNeedsBackground,
  flatSpecNeedsSpray,
  type FlatProductId,
  type FlatTemplateSpec,
} from "@/lib/flatTemplates";
import {
  TEMPLATE_SPECS,
  buildTemplateLayout,
  isSprayArchetype,
  type TemplateSpec,
} from "@/lib/templateGenerator";

/** Shipped asset, used until a real thumbnail lands so preview_image_url is never a 404. */
const PLACEHOLDER_PREVIEW = "/fs-monogram.webp";

function flag(name: string): string | undefined {
  const match = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return match?.slice(name.length + 3);
}

const has = (name: string) => process.argv.includes(`--${name}`);

const origin = flag("origin") ?? "http://localhost:3000";
const productFlag = flag("product");
const bookletProduct = productFlag ?? "order-of-service";
const only = flag("only")?.split(",").map((entry) => entry.trim()).filter(Boolean);
const force = has("force");
const thumbnails = !has("no-thumbnails");

/** One template to write, whichever library it came from. */
interface Job {
  slug: string;
  name: string;
  productSlug: string;
  categories: string[];
  trim: PageTrim;
  /** The layout, or why it can't be built yet. */
  build: () => Promise<DesignPage[] | { missing: string }>;
}

function bookletJob(spec: TemplateSpec, trim: PageTrim): Job {
  return {
    slug: spec.slug,
    name: spec.name,
    productSlug: bookletProduct,
    categories: spec.categories,
    trim,
    build: async () => {
      let backgroundUrl: string | undefined;
      let sprayUrl: string | undefined;
      if (spec.background) {
        if (isSprayArchetype(spec.archetype)) {
          sprayUrl = sprayAssetUrl(spec.background);
        } else {
          if (!isStorageConfigured() && !(await backgroundAssetExists(spec.background, spec.palette))) {
            return { missing: `background "${spec.background}/${spec.palette}"` };
          }
          backgroundUrl = backgroundAssetUrl(spec.background, spec.palette);
        }
      }
      const accentUrl = spec.accent ? sprayAssetUrl(spec.accent) : undefined;
      return buildTemplateLayout(spec, { backgroundUrl, sprayUrl, accentUrl });
    },
  };
}

async function buildFlat(
  spec: FlatTemplateSpec,
  trim: PageTrim,
): Promise<DesignPage[] | { missing: string }> {
  let backgroundUrl: string | undefined;
  if (flatSpecNeedsBackground(spec) && spec.background) {
    const format = flatBackgroundFormat(spec);
    if (!isStorageConfigured() && !(await backgroundAssetExists(spec.background, spec.palette, format))) {
      return { missing: `background "${spec.background}/${spec.palette}/${format}"` };
    }
    backgroundUrl = backgroundAssetUrl(spec.background, spec.palette, format);
  }
  return buildFlatTemplateLayout(spec, trim, {
    sprayUrl: flatSpecNeedsSpray(spec) && spec.spray ? sprayAssetUrl(spec.spray) : undefined,
    backgroundUrl,
  });
}

async function generate(job: Job, sortOrder: number) {
  const existing = await adminGetTemplate(job.slug);
  if (existing && !force) return { outcome: "skipped" as const };

  const pages = await job.build();
  if ("missing" in pages) return { outcome: "missing" as const, missing: pages.missing };

  if (existing) {
    await adminUpdateTemplate(job.slug, {
      name: job.name,
      productSlug: job.productSlug,
      categories: job.categories,
    });
  } else {
    await adminCreateTemplate({
      slug: job.slug,
      name: job.name,
      productSlug: job.productSlug,
      previewImageUrl: PLACEHOLDER_PREVIEW,
      status: "draft",
      sortOrder,
      categories: job.categories,
    });
  }

  // Go through the normal draft→publish seam rather than writing `layout`
  // directly, so generated rows end up in exactly the state the authoring
  // editor would leave them in: layout set, no dangling draft.
  await adminSaveTemplateDraftLayout(job.slug, pages);
  const published = await adminPublishTemplateLayout(job.slug);
  if (published.status !== "published") {
    throw new Error(`Could not publish layout for "${job.slug}" (${published.status})`);
  }

  if (!thumbnails) return { outcome: "created" as const, thumbnail: false };

  // Best-effort, matching the admin publish route: a thumbnail failure leaves
  // a usable template rather than aborting the whole run.
  try {
    const png = await renderTemplateThumbnail(origin, pages[0], job.slug, job.trim);
    const url = await saveTemplateThumbnail(job.slug, png);
    await adminUpdateTemplate(job.slug, { previewImageUrl: url });
    return { outcome: "created" as const, thumbnail: true };
  } catch (error) {
    console.warn(`  ! thumbnail failed for "${job.slug}": ${(error as Error).message}`);
    return { outcome: "created" as const, thumbnail: false };
  }
}

/** The trim a product's templates are drawn on, read from the products row. */
async function productTrim(slug: string): Promise<{ trim: PageTrim; templatePages: number }> {
  const product = await adminGetProduct(slug);
  if (!product) throw new Error(`Unknown product "${slug}" — run the migrations first`);
  const format = toProductFormat(product);
  return { trim: format.trim, templatePages: format.templatePages };
}

async function jobs(): Promise<Job[]> {
  const flatOnly = (FLAT_PRODUCTS as readonly string[]).includes(productFlag ?? "");
  const list: Job[] = [];

  if (!flatOnly) {
    // The booklet library is cover/middle/back on A5; on any other format it
    // would be stretched, or have pages the product doesn't print.
    const booklet = await productTrim(bookletProduct);
    if (booklet.templatePages !== 3 || !sameTrim(booklet.trim, A5_TRIM)) {
      throw new Error(
        `"${bookletProduct}" isn't an A5 booklet — the booklet library only fits one. ` +
          `Its own templates come from src/lib/flatTemplates.ts if it has any.`,
      );
    }
    list.push(...TEMPLATE_SPECS.map((spec) => bookletJob(spec, booklet.trim)));
  }

  if (!productFlag || flatOnly) {
    const flatSpecs = FLAT_TEMPLATE_SPECS.filter(
      (spec) => !flatOnly || spec.product === (productFlag as FlatProductId),
    );
    const trims = new Map<string, PageTrim>();
    for (const product of new Set(flatSpecs.map((spec) => spec.product))) {
      trims.set(product, (await productTrim(product)).trim);
    }
    for (const spec of flatSpecs) {
      const trim = trims.get(spec.product)!;
      list.push({
        slug: spec.slug,
        name: spec.name,
        productSlug: spec.product,
        categories: spec.categories,
        trim,
        build: () => buildFlat(spec, trim),
      });
    }
  }
  return list;
}

async function main() {
  const all = await jobs();
  const specs = only ? all.filter((job) => only.includes(job.slug)) : all;

  if (specs.length === 0) {
    console.error(only ? `No specs matched --only=${only.join(",")}` : "No specs to generate");
    process.exitCode = 1;
    return;
  }

  const current = await adminListTemplates();
  let nextSortOrder = current.reduce((max, entry) => Math.max(max, entry.sortOrder), -1) + 1;

  console.log(
    `Generating ${specs.length} template(s) as drafts` +
      (thumbnails ? ` (thumbnails via ${origin})` : " (thumbnails skipped)"),
  );
  if (thumbnails && !isStorageConfigured()) {
    console.log("S3 is not configured — writing thumbnails to public/templates/<slug>/cover.png");
  }

  const results = [];
  for (const job of specs) {
    const result = await generate(job, nextSortOrder);
    if (result.outcome === "created") nextSortOrder += 1;
    console.log(
      result.outcome === "skipped"
        ? `  - ${job.slug} (already exists — pass --force to rebuild)`
        : result.outcome === "missing"
          ? `  ! ${job.slug} skipped — ${result.missing} not rendered (run npm run backgrounds:fetch)`
          : `  ✓ ${job.slug} [${job.productSlug}]${result.thumbnail ? "" : " (no thumbnail)"}`,
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
