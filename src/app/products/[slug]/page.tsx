import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import Breadcrumb from "@/components/Breadcrumb";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { DesignForYouCard, UploadDesignCard } from "@/components/OtherWaysCards";
import ProductDesigns from "@/components/ProductDesigns";
import {
  getCategories,
  getSellableProduct,
  getTemplates,
} from "@/lib/catalogue.server";
import { sizeText } from "@/lib/designEditor";
import {
  copiesText,
  defaultSelection,
  formatPence,
  getQuote,
  type PricingData,
} from "@/lib/orderOfServicePricing";
import { getPricingData } from "@/lib/pricing.server";
import { ORDER_CUTOFF } from "@/lib/site";

// Pricing and the catalogue live in MySQL and are editable from /admin, so
// this page must render per-request rather than being frozen at build time.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getSellableProduct(slug);
  if (!product) return { title: "Not found | The Funeral Stationery" };
  return {
    title: `${product.label} | The Funeral Stationery`,
    description: `${product.templateCount} ${product.label.toLowerCase()} designs to personalise online, from ${formatPence(product.fromPence)} for ${copiesText(product.fromCopies)}. Printed on heavyweight paper and delivered anywhere in the UK.`,
  };
}

const priceOrFree = (pence: number) => (pence === 0 ? "Free" : formatPence(pence));

/**
 * "Prices at a glance": print cost for every copies × page-count pair, on the
 * product's default paper, read from the same PricingData as the buy box — so
 * the table can never disagree with what a design's page goes on to charge.
 * Delivery is left out (it is chosen per order) and listed beside the table.
 */
function priceTable(pricing: PricingData) {
  const base = defaultSelection(pricing);
  return {
    paper: pricing.paper[0],
    columns: pricing.pages,
    rows: pricing.quantity.map((quantity) => ({
      quantity,
      prices: pricing.pages.map(
        (pages) =>
          getQuote(pricing, { ...base, quantity: quantity.id, pages: pages.id }).printCostPence,
      ),
    })),
  };
}

export default async function ProductPage({
  params,
  searchParams,
}: PageProps<"/products/[slug]">) {
  const [{ slug }, { category: categoryParam }] = await Promise.all([params, searchParams]);
  // Only sellable products have a page: an active product still missing
  // templates or a pricing table 404s here exactly as it is absent from the
  // shop and the header menu.
  const product = await getSellableProduct(slug);
  if (!product) notFound();

  const [pricing, templates, categories] = await Promise.all([
    getPricingData(product.id),
    getTemplates(),
    getCategories(),
  ]);
  const productTemplates = templates.filter((template) => template.productId === product.id);
  const usedCategoryIds = new Set(productTemplates.flatMap((template) => template.categories));
  const productCategories = categories.filter((category) => usedCategoryIds.has(category.id));
  // A stale or unknown ?category= shows every design rather than 404ing.
  const initialCategoryId =
    productCategories.find((category) => category.id === categoryParam)?.id ?? null;

  const table = priceTable(pricing);
  const facts: { term: string; value: string; detail?: string }[] = [
    {
      term: "Prices from",
      value: formatPence(product.fromPence),
      detail: `/ ${copiesText(product.fromCopies)}`,
    },
    ...pricing.delivery.map((option) => ({
      term: option.label,
      value: priceOrFree(option.pricePence),
    })),
    { term: "Order by", value: ORDER_CUTOFF, detail: "weekdays" },
  ];

  return (
    <>
      <Header />
      <main className="type-body flex-1">
        <section className="bg-paper">
          <div className="site-container grid grid-cols-[repeat(auto-fit,minmax(min(460px,100%),1fr))] items-end gap-x-16 gap-y-8 pb-8 pt-10 md:pt-14">
            <div className="flex flex-col gap-5">
              <Breadcrumb
                items={[
                  { label: "Home", href: "/" },
                  { label: "Shop", href: "/shop" },
                  { label: product.label },
                ]}
              />
              <h1 className="type-page">{product.label}</h1>
              <p className="max-w-[34em] text-xl text-ink-2">
                Choose a design, then add their photographs and words online.{" "}
                {product.format.sizedByOption
                  ? `Printed at the size you choose, from ${product.format.sizeLabel.replace(" to ", " up to ")}.`
                  : `Printed at exact ${sizeText(product.format)}.`}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-4">
              {facts.map((fact) => (
                <div key={fact.term} className="rounded-xl border border-line bg-surface px-5 py-[18px]">
                  <dt className="text-sm text-ink-3">{fact.term}</dt>
                  <dd className="font-semibold">
                    {fact.value}
                    {fact.detail && (
                      <span className="text-[15px] font-normal text-ink-3"> {fact.detail}</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="bg-paper">
          <ProductDesigns
            productId={product.id}
            templates={productTemplates}
            trim={product.format.trim}
            categories={productCategories}
            initialCategoryId={initialCategoryId}
            priceLine={`from ${formatPence(product.fromPence)}`}
          />
        </section>

        <section id="prices" className="scroll-mt-4 border-y border-line bg-surface">
          <div className="site-container flex flex-col gap-10 py-20">
            <div className="flex max-w-[640px] flex-col gap-4">
              <h2 className="type-sub">Prices at a glance</h2>
              <p className="text-ink-2">
                Every design costs the same. The price depends on how many copies
                {table.columns.length > 1
                  ? product.format.sizedByOption
                    ? " and the size"
                    : " and pages"
                  : ""}{" "}
                you need
                {table.paper
                  ? product.format.paperLabel === "Paper"
                    ? `, shown here on ${table.paper.label.toLowerCase()} paper`
                    : `, shown here as ${table.paper.label.toLowerCase()}`
                  : ""}
                .
                Delivery is added at the basket:{" "}
                {pricing.delivery
                  .map(
                    (option) =>
                      `${option.label.toLowerCase()} ${
                        option.pricePence === 0 ? "is free" : `is ${formatPence(option.pricePence)}`
                      }`,
                  )
                  .join(", ")}
                .
              </p>
              <p className="text-ink-2">
                Choose any design above to work out your exact price, with your{" "}
                {product.format.paperLabel.toLowerCase()} and delivery.
              </p>
            </div>
            <div
              className="overflow-x-auto rounded-xl border border-line"
              role="region"
              aria-label="Price table"
              tabIndex={0}
            >
              <table className="w-full min-w-[380px] border-collapse text-[17px]">
                <thead>
                  <tr className="bg-mist-2 text-left">
                    <th scope="col" className="px-5 py-3.5 font-semibold">
                      Copies
                    </th>
                    {table.columns.map((column) => (
                      <th key={column.id} scope="col" className="whitespace-nowrap px-5 py-3.5 font-semibold">
                        {table.columns.length > 1 ? column.label : "Price"}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row) => (
                    <tr key={row.quantity.id} className="border-t border-line">
                      <th scope="row" className="px-5 py-3.5 text-left font-medium">
                        {row.quantity.value}
                      </th>
                      {row.prices.map((price, index) => (
                        <td key={table.columns[index].id} className="whitespace-nowrap px-5 py-3.5">
                          {formatPence(price)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="bg-paper">
          <div className="site-container flex flex-col gap-8 pb-24 pt-20">
            <h2 className="type-sub">Can’t find the right design?</h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(380px,100%),1fr))] gap-6">
              <DesignForYouCard />
              <UploadDesignCard />
            </div>
            <p className="text-base text-ink-2">
              Looking for something else?{" "}
              <Link href="/shop" className="link font-medium">
                See everything in the shop
              </Link>
              .
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
