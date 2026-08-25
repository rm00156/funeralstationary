import "dotenv/config";
import { sql } from "drizzle-orm";
import type { AnyMySqlTable, MySqlColumn } from "drizzle-orm/mysql-core";
import { db } from "./index";
import {
  colourOptions,
  deliveryOptions,
  pageCountOptions,
  paperOptions,
  products,
  quantityOptions,
  sizeOptions,
  templateCategories,
  templateCategoryLinks,
  templates,
} from "./schema";
import {
  buildColourOptionsSeed,
  buildDeliveryOptionsSeed,
  buildPageCountOptionsSeed,
  buildPaperOptionsSeed,
  buildProductsSeed,
  buildQuantityOptionsSeed,
  buildSizeOptionsSeed,
  buildTemplateCategoriesSeed,
  buildTemplateCategoryLinksSeed,
  buildTemplatesSeed,
} from "./seedData";

/**
 * `INSERT ... ON DUPLICATE KEY UPDATE col = VALUES(col)` — re-running the
 * seed re-applies every column from the incoming row rather than leaving
 * stale values, which is what makes it idempotent against edits to the
 * src/lib constants. MySQL triggers this off ANY unique key collision, not
 * just the PK, so it works whether the conflicting key is `slug` or a
 * composite (product_id, slug).
 */
function valuesOf(table: AnyMySqlTable, ...columns: string[]) {
  const set: Record<string, ReturnType<typeof sql>> = {};
  for (const column of columns) {
    const dbName = (table as unknown as Record<string, { name: string }>)[column].name;
    set[column] = sql`values(${sql.identifier(dbName)})`;
  }
  return set;
}

/**
 * Every catalogue/pricing table uses a surrogate int PK, so a row's id isn't
 * known until after it's inserted — unlike the old varchar-slug PKs, which
 * doubled as the FK value. This upserts by `slug`, then re-selects the whole
 * table to build a slug->id map the next step can resolve its FKs against.
 */
async function upsertAndMapBySlug(
  table: AnyMySqlTable & { id: MySqlColumn; slug: MySqlColumn },
  rows: Array<Record<string, unknown>>,
  updateColumns: string[],
): Promise<Map<string, number>> {
  if (rows.length > 0) {
    await db.insert(table).values(rows).onDuplicateKeyUpdate({ set: valuesOf(table, ...updateColumns) });
  }
  const all = (await db
    .select({ id: table.id, slug: table.slug })
    .from(table as never)) as Array<{ id: number; slug: string }>;
  return new Map(all.map((row) => [row.slug, row.id]));
}

async function main() {
  const productBySlug = await upsertAndMapBySlug(products, buildProductsSeed(), [
    "label",
    "sortOrder",
    "isActive",
  ]);

  const categoryBySlug = await upsertAndMapBySlug(templateCategories, buildTemplateCategoriesSeed(), [
    "label",
    "accentHex",
    "sortOrder",
    "isActive",
  ]);

  const templateRows = buildTemplatesSeed().map(({ productSlug, ...row }) => {
    const productId = productBySlug.get(productSlug);
    if (!productId) throw new Error(`Seed template "${row.slug}" references unknown product "${productSlug}"`);
    return { ...row, productId };
  });
  const templateBySlug = await upsertAndMapBySlug(templates, templateRows, [
    "name",
    "productId",
    "previewImageUrl",
    "status",
    "sortOrder",
  ]);

  // Pure join table, no data beyond the pair itself — delete-then-insert
  // fully reconciles to the source instead of only ever accumulating rows
  // (a plain upsert would leave stale links behind if a template's
  // categories ever shrink).
  const categoryLinkRows = buildTemplateCategoryLinksSeed().map(
    ({ templateSlug, categorySlug, position }) => {
      const templateId = templateBySlug.get(templateSlug);
      const categoryId = categoryBySlug.get(categorySlug);
      if (!templateId || !categoryId) {
        throw new Error(`Seed link ${templateSlug}/${categorySlug} references an unknown row`);
      }
      return { templateId, categoryId, position };
    },
  );
  await db.transaction(async (tx) => {
    await tx.delete(templateCategoryLinks);
    if (categoryLinkRows.length > 0) {
      await tx.insert(templateCategoryLinks).values(categoryLinkRows);
    }
  });

  const specColumns = ["label", "multiplier", "note", "sortOrder", "isActive"] as const;

  async function upsertPricingTable(
    table: AnyMySqlTable,
    rows: Array<{ productSlug: string } & Record<string, unknown>>,
    updateColumns: string[],
  ) {
    const resolved = rows.map(({ productSlug, ...row }) => {
      const productId = productBySlug.get(productSlug);
      if (!productId) {
        throw new Error(`Seed pricing row "${row.slug}" references unknown product "${productSlug}"`);
      }
      return { ...row, productId };
    });
    if (resolved.length === 0) return;
    await db
      .insert(table)
      .values(resolved)
      .onDuplicateKeyUpdate({ set: valuesOf(table, ...updateColumns) });
  }

  await upsertPricingTable(sizeOptions, buildSizeOptionsSeed(), [...specColumns]);
  await upsertPricingTable(colourOptions, buildColourOptionsSeed(), [...specColumns]);
  await upsertPricingTable(paperOptions, buildPaperOptionsSeed(), [...specColumns]);
  await upsertPricingTable(quantityOptions, buildQuantityOptionsSeed(), [...specColumns, "copies"]);
  await upsertPricingTable(pageCountOptions, buildPageCountOptionsSeed(), [
    "label",
    "pageCount",
    "baseRatePence",
    "note",
    "sortOrder",
    "isActive",
  ]);
  await upsertPricingTable(deliveryOptions, buildDeliveryOptionsSeed(), [
    "label",
    "pricePence",
    "note",
    "sortOrder",
    "isActive",
  ]);

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
