/**
 * Post-seed integrity check for CI.
 *
 * Asserts the seeded database matches the src/lib constants it was built
 * from. Expectations are derived from the same builders the seed uses, not
 * hardcoded counts, so this keeps working as the catalogue grows — it fails
 * when the database and the source of truth disagree, which is the thing
 * worth catching.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "@/db";
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
} from "@/db/schema";
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
} from "@/db/seedData";

const failures: string[] = [];

function expect(label: string, actual: number, wanted: number) {
  if (actual === wanted) {
    console.log(`  ok   ${label}: ${actual}`);
  } else {
    failures.push(`${label}: expected ${wanted}, found ${actual}`);
    console.log(`  FAIL ${label}: expected ${wanted}, found ${actual}`);
  }
}

async function main() {
  console.log("Verifying seeded catalogue…");

  expect("products", (await db.select().from(products)).length, buildProductsSeed().length);
  expect(
    "template_categories",
    (await db.select().from(templateCategories)).length,
    buildTemplateCategoriesSeed().length,
  );
  expect("templates", (await db.select().from(templates)).length, buildTemplatesSeed().length);
  expect(
    "template_category_links",
    (await db.select().from(templateCategoryLinks)).length,
    buildTemplateCategoryLinksSeed().length,
  );
  expect("size_options", (await db.select().from(sizeOptions)).length, buildSizeOptionsSeed().length);
  expect(
    "colour_options",
    (await db.select().from(colourOptions)).length,
    buildColourOptionsSeed().length,
  );
  expect("paper_options", (await db.select().from(paperOptions)).length, buildPaperOptionsSeed().length);
  expect(
    "quantity_options",
    (await db.select().from(quantityOptions)).length,
    buildQuantityOptionsSeed().length,
  );
  expect(
    "page_count_options",
    (await db.select().from(pageCountOptions)).length,
    buildPageCountOptionsSeed().length,
  );
  expect(
    "delivery_options",
    (await db.select().from(deliveryOptions)).length,
    buildDeliveryOptionsSeed().length,
  );

  // Referential integrity: every template must join to a real product. An
  // inner join dropping rows means a template_id/product_id went bad.
  const joined = await db
    .select({ templateSlug: templates.slug, productSlug: products.slug })
    .from(templates)
    .innerJoin(products, eq(templates.productId, products.id));
  expect("templates joined to a product", joined.length, buildTemplatesSeed().length);

  // Spot-check the pounds->pence conversion actually landed in the column,
  // not just in the builder (unit tests already cover the builder).
  const [fourPage] = await db
    .select({ baseRatePence: pageCountOptions.baseRatePence })
    .from(pageCountOptions)
    .where(eq(pageCountOptions.slug, "4"))
    .limit(1);
  expect('page_count_options."4".base_rate_pence', fourPage?.baseRatePence ?? -1, 220);

  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed:`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }

  console.log("\nCatalogue matches the source constants.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
