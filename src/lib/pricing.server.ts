/**
 * Server-side reads for a product's pricing options.
 *
 * Loads the six option tables into the pure PricingData shape getQuote()
 * consumes. Money columns are already integer pence; multiplier columns are
 * decimal(6,4) strings from the driver and become plain numbers here (exact
 * for 4dp values). Only active rows are returned, in sort order — the admin
 * area reads the tables through its own seam instead.
 */
import { and, asc, eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import {
  colourOptions,
  deliveryOptions,
  pageCountOptions,
  paperOptions,
  products,
  quantityOptions,
  sizeOptions,
} from "@/db/schema";
import type {
  DeliveryOption,
  PageCountOption,
  PricingData,
  QuantityOption,
  SelectOption,
} from "@/lib/orderOfServicePricing";

async function resolveProductId(productSlug: string): Promise<number> {
  const [row] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.slug, productSlug))
    .limit(1);
  if (!row) throw new Error(`Unknown product "${productSlug}"`);
  return row.id;
}

type MultiplierTable =
  | typeof sizeOptions
  | typeof colourOptions
  | typeof paperOptions;

async function loadMultiplierOptions(
  table: MultiplierTable,
  productId: number,
): Promise<SelectOption[]> {
  const rows = await db
    .select({
      slug: table.slug,
      label: table.label,
      multiplier: table.multiplier,
      note: table.note,
    })
    .from(table)
    .where(and(eq(table.productId, productId), eq(table.isActive, true)))
    .orderBy(asc(table.sortOrder), asc(table.id));
  return rows.map((row) => ({
    id: row.slug,
    label: row.label,
    multiplier: Number(row.multiplier),
    note: row.note ?? undefined,
  }));
}

export const getPricingData = cache(
  async (productSlug: string): Promise<PricingData> => {
    const productId = await resolveProductId(productSlug);

    const [size, colour, paper, quantityRows, pageRows, deliveryRows] =
      await Promise.all([
        loadMultiplierOptions(sizeOptions, productId),
        loadMultiplierOptions(colourOptions, productId),
        loadMultiplierOptions(paperOptions, productId),
        db
          .select({
            slug: quantityOptions.slug,
            label: quantityOptions.label,
            multiplier: quantityOptions.multiplier,
            note: quantityOptions.note,
            copies: quantityOptions.copies,
          })
          .from(quantityOptions)
          .where(
            and(
              eq(quantityOptions.productId, productId),
              eq(quantityOptions.isActive, true),
            ),
          )
          .orderBy(asc(quantityOptions.sortOrder), asc(quantityOptions.id)),
        db
          .select({
            slug: pageCountOptions.slug,
            label: pageCountOptions.label,
            pageCount: pageCountOptions.pageCount,
            baseRatePence: pageCountOptions.baseRatePence,
            note: pageCountOptions.note,
          })
          .from(pageCountOptions)
          .where(
            and(
              eq(pageCountOptions.productId, productId),
              eq(pageCountOptions.isActive, true),
            ),
          )
          .orderBy(asc(pageCountOptions.sortOrder), asc(pageCountOptions.id)),
        db
          .select({
            slug: deliveryOptions.slug,
            label: deliveryOptions.label,
            pricePence: deliveryOptions.pricePence,
            note: deliveryOptions.note,
          })
          .from(deliveryOptions)
          .where(
            and(
              eq(deliveryOptions.productId, productId),
              eq(deliveryOptions.isActive, true),
            ),
          )
          .orderBy(asc(deliveryOptions.sortOrder), asc(deliveryOptions.id)),
      ]);

    const quantity: QuantityOption[] = quantityRows.map((row) => ({
      id: row.slug,
      label: row.label,
      multiplier: Number(row.multiplier),
      note: row.note ?? undefined,
      value: row.copies,
    }));
    const pages: PageCountOption[] = pageRows.map((row) => ({
      id: row.slug,
      label: row.label,
      pages: row.pageCount,
      baseRatePence: row.baseRatePence,
      note: row.note ?? undefined,
    }));
    const delivery: DeliveryOption[] = deliveryRows.map((row) => ({
      id: row.slug,
      label: row.label,
      pricePence: row.pricePence,
      note: row.note,
    }));

    return { quantity, size, colour, pages, paper, delivery };
  },
);

/** Resolve one page-count option by slug — used to validate incoming specs. */
export const getPageCountOption = cache(
  async (
    productSlug: string,
    slug: string,
  ): Promise<{ slug: string; pageCount: number } | null> => {
    const [row] = await db
      .select({
        slug: pageCountOptions.slug,
        pageCount: pageCountOptions.pageCount,
      })
      .from(pageCountOptions)
      .innerJoin(products, eq(pageCountOptions.productId, products.id))
      .where(and(eq(products.slug, productSlug), eq(pageCountOptions.slug, slug)))
      .limit(1);
    return row ?? null;
  },
);
