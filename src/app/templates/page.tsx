import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Star } from "lucide-react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HowItWorks from "@/components/HowItWorks";
import TemplateBrowser from "@/components/TemplateBrowser";
import { getCategories, getSellableProducts, getTemplates } from "@/lib/catalogue.server";
import { selectionSearchParams, type Selection } from "@/lib/orderOfServicePricing";

// The catalogue lives in MySQL and is editable from /admin, so this page
// must render per-request rather than being frozen at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Funeral Stationery Templates | The Funeral Stationery",
  description:
    "Browse our funeral stationery templates and personalise the wording, photographs, colours and pages. Design it yourself, or send us your content and we will put every page together for you.",
};

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; category?: string } & Partial<Selection>>;
}) {
  const [
    { product: productParam, category: categoryParam, ...carried },
    products,
    categories,
    templates,
  ] = await Promise.all([searchParams, getSellableProducts(), getCategories(), getTemplates()]);

  // The product pages, the shop menu and their theme chips deep-link in
  // here. Unknown slugs fall back to the defaults rather than 404ing — a
  // stale bookmark for an archived category should still show the browser.
  const initialProduct = products.find((product) => product.id === productParam) ?? null;
  const initialCategoryId =
    categories.find((category) => category.id === categoryParam)?.id ?? null;

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="px-margin-mobile md:px-gutter pt-8 pb-section-gap bg-surface">
          <div className="max-w-[1200px] mx-auto">
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-2 font-body text-sm text-on-surface-variant mb-10"
            >
              <Link href="/" className="hover:text-primary transition-colors">
                Home
              </Link>
              <ChevronRight size={14} aria-hidden />
              <span className="text-on-surface">Templates</span>
            </nav>

            <div className="text-center flex flex-col items-center">
              <h1 className="font-display text-4xl md:text-5xl font-semibold text-primary max-w-4xl leading-tight mb-8">
                {initialProduct ? `${initialProduct.label} Templates` : "Funeral Stationery Templates"}
              </h1>

              <p className="font-body text-lg md:text-xl text-on-surface-variant max-w-3xl mb-10">
                Choose a template and personalise the wording, photographs,
                colours and pages. When your design is ready, we print and
                deliver it anywhere in the UK. Do it yourself, or send us your
                content and we will put every page together for you.
              </p>

              <p className="inline-flex items-center gap-3 rounded-full border border-outline-variant/40 bg-surface-container-lowest px-6 py-3 font-body text-sm text-on-surface-variant ambient-shadow">
                <span className="flex items-center gap-0.5 text-secondary">
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star
                      key={index}
                      size={14}
                      aria-hidden
                      className="fill-secondary"
                    />
                  ))}
                </span>
                <span>
                  <span className="font-semibold text-on-surface">
                    Rated 4.9
                  </span>{" "}
                  from 164 verified customer reviews
                </span>
              </p>
            </div>

            <div className="mt-12 md:mt-16">
              <TemplateBrowser
                products={products.map(({ id, label }) => ({ id, label }))}
                categories={categories}
                templates={templates}
                initialProductId={initialProduct?.id ?? null}
                initialCategoryId={initialCategoryId}
                // The product page's options, forwarded untouched — /design
                // validates them against the product's pricing.
                carriedSelection={
                  initialProduct ? selectionSearchParams(carried).toString() : ""
                }
              />
            </div>
          </div>
        </section>

        <HowItWorks />
      </main>
      <Footer />
    </>
  );
}
