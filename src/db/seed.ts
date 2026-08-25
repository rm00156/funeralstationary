import "dotenv/config";
import { sql } from "drizzle-orm";
import type { AnyMySqlTable } from "drizzle-orm/mysql-core";
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
  templateProductLinks,
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
  buildTemplateProductLinksSeed,
  buildTemplatesSeed,
} from "./seedData";

/**
 * `INSERT ... ON DUPLICATE KEY UPDATE col = VALUES(col)` — re-running the
 * seed re-applies every column from the incoming row rather than leaving
 * stale values, which is what makes it idempotent against edits to the
 * src/lib constants.
 */
function valuesOf(table: AnyMySqlTable, ...columns: string[]) {
  const set: Record<string, ReturnType<typeof sql>> = {};
  for (const column of columns) {
    const dbName = (table as unknown as Record<string, { name: string }>)[column].name;
    set[column] = sql`values(${sql.identifier(dbName)})`;
  }
  return set;
}

async function main() {
  await db
    .insert(products)
    .values(buildProductsSeed())
    .onDuplicateKeyUpdate({ set: valuesOf(products, "label", "sortOrder", "isActive") });

  await db
    .insert(templateCategories)
    .values(buildTemplateCategoriesSeed())
    .onDuplicateKeyUpdate({
      set: valuesOf(templateCategories, "label", "accentHex", "sortOrder", "isActive"),
    });

  await db
    .insert(templates)
    .values(buildTemplatesSeed())
    .onDuplicateKeyUpdate({
      set: valuesOf(templates, "name", "previewImageUrl", "status", "sortOrder"),
    });

  await db
    .insert(templateCategoryLinks)
    .values(buildTemplateCategoryLinksSeed())
    .onDuplicateKeyUpdate({ set: valuesOf(templateCategoryLinks, "position") });

  await db
    .insert(templateProductLinks)
    .values(buildTemplateProductLinksSeed())
    .onDuplicateKeyUpdate({ set: valuesOf(templateProductLinks, "productId") });

  const specColumns = ["label", "multiplier", "note", "sortOrder", "isActive"] as const;

  await db
    .insert(sizeOptions)
    .values(buildSizeOptionsSeed())
    .onDuplicateKeyUpdate({ set: valuesOf(sizeOptions, ...specColumns) });

  await db
    .insert(colourOptions)
    .values(buildColourOptionsSeed())
    .onDuplicateKeyUpdate({ set: valuesOf(colourOptions, ...specColumns) });

  await db
    .insert(paperOptions)
    .values(buildPaperOptionsSeed())
    .onDuplicateKeyUpdate({ set: valuesOf(paperOptions, ...specColumns) });

  await db
    .insert(quantityOptions)
    .values(buildQuantityOptionsSeed())
    .onDuplicateKeyUpdate({ set: valuesOf(quantityOptions, ...specColumns, "copies") });

  await db
    .insert(pageCountOptions)
    .values(buildPageCountOptionsSeed())
    .onDuplicateKeyUpdate({
      set: valuesOf(pageCountOptions, "label", "pageCount", "baseRatePence", "note", "sortOrder", "isActive"),
    });

  await db
    .insert(deliveryOptions)
    .values(buildDeliveryOptionsSeed())
    .onDuplicateKeyUpdate({
      set: valuesOf(deliveryOptions, "label", "pricePence", "note", "sortOrder", "isActive"),
    });

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
