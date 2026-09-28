import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChevronRight, Clock, Heart, Palette } from "lucide-react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HowItWorks from "@/components/HowItWorks";
import ProductConfigurator from "@/components/ProductConfigurator";
import ProductPreviewGallery from "@/components/ProductPreviewGallery";
import {
  getCategories,
  getSellableProduct,
  getTemplates,
} from "@/lib/catalogue.server";
import { PAGE_H_MM, PAGE_SIZE_LABEL, PAGE_W_MM } from "@/lib/designEditor";
import { formatPence, type PricingData } from "@/lib/orderOfServicePricing";
import { getPricingData } from "@/lib/pricing.server";

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
    description: `Personalised ${product.label.toLowerCase()} from ${formatPence(product.fromPence)} for ${product.fromCopies} copies. Choose your options, see the price instantly, and have them delivered next day.`,
  };
}

const INCLUDED = [
  {
    icon: Palette,
    title: "Your design, or ours",
    description:
      "Start from one of our designs and personalise every page yourself, or send us your content and we will put it together for you.",
  },
  {
    icon: Heart,
    title: "Checked before it prints",
    description:
      "Empty photo windows and unedited template wording are caught before you pay, so what arrives is exactly what you approved.",
  },
  {
    icon: Clock,
    title: "24hrs to 72hrs turnaround",
    description:
      "Order before 11am with next day delivery selected and it is with you the next working day.",
  },
];

/**
 * The specification table, read straight from the product's pricing options
 * so it can never disagree with what the calculator offers. An axis with no
 * choices to list is left out.
 */
function specificationRows(pricing: PricingData): [string, string][] {
  const labels = (options: { label: string }[]) =>
    options.map((option) => option.label).join(", ");
  const minimum = Math.min(...pricing.quantity.map((option) => option.value));
  const rows: [string, string][] = [
    ["Size", `${PAGE_SIZE_LABEL} (${PAGE_W_MM} x ${PAGE_H_MM}mm)`],
    ["Page counts", labels(pricing.pages)],
    ["Paper", labels(pricing.paper)],
    ["Minimum order", `${minimum} copies`],
    [
      "Delivery",
      pricing.delivery
        .map(
          (option) =>
            `${option.label} (${option.pricePence === 0 ? "free" : formatPence(option.pricePence)})`,
        )
        .join(", "),
    ],
  ];
  return rows.filter(([, detail]) => detail.length > 0);
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  // Only sellable products have a page: an active product still missing
  // templates or a pricing table 404s here exactly as it is absent from the
  // home page and the shop menu.
  const product = await getSellableProduct(slug);
  if (!product) notFound();

  const [pricing, templates, categories] = await Promise.all([
    getPricingData(product.id),
    getTemplates(),
    getCategories(),
  ]);
  const productTemplates = templates.filter((template) => template.productId === product.id);
  const themeIds = new Set(productTemplates.flatMap((template) => template.categories));
  const themes = categories.filter((category) => themeIds.has(category.id));

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="px-margin-mobile md:px-gutter pt-8 pb-section-gap md:pt-10 bg-surface">
          <div className="max-w-[1200px] mx-auto">
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-2 font-body text-sm text-on-surface-variant mb-4"
            >
              <Link href="/" className="hover:text-primary transition-colors">
                Home
              </Link>
              <ChevronRight size={14} aria-hidden />
              <span className="text-on-surface">{product.label}</span>
            </nav>

            <h1 className="font-display text-3xl md:text-4xl font-semibold text-primary leading-tight mb-2">
              {product.label}
            </h1>
            <p className="font-body text-lg text-on-surface-variant mb-6">
              From{" "}
              <span className="font-semibold text-secondary">
                {formatPence(product.fromPence)}
              </span>{" "}
              for {product.fromCopies} copies
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 lg:gap-x-16 gap-y-6 items-start">
              <div className="order-2 lg:order-1 lg:sticky lg:top-28">
                <ProductPreviewGallery
                  productLabel={product.label}
                  templates={productTemplates
                    .slice(0, 5)
                    .map(({ id, name, image }) => ({ id, name, image }))}
                />

                {themes.length > 0 && (
                  <>
                    <p className="font-body text-sm uppercase tracking-[0.18em] text-secondary mt-8 mb-4">
                      Available themes
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {themes.map((theme) => (
                        <Link
                          key={theme.id}
                          href={`/templates?product=${product.id}&category=${theme.id}`}
                          className="rounded-full bg-soft-sage px-5 py-2 font-body text-sm font-medium tracking-wide text-secondary transition-colors hover:bg-secondary-container"
                        >
                          {theme.label}
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="order-1 lg:order-2 lg:-mt-[69px]">
                <ProductConfigurator productId={product.id} pricing={pricing} />
              </div>
            </div>
          </div>
        </section>

        <section className="px-margin-mobile md:px-gutter py-section-gap bg-surface-container-low">
          <div className="max-w-[1200px] mx-auto">
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-primary mb-4 text-center">
              What Every Order Includes
            </h2>
            <p className="font-body text-lg text-on-surface-variant max-w-2xl mx-auto text-center mb-16">
              The price you see covers everything from your first draft to the
              box arriving at your door.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {INCLUDED.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-soft-sage bg-surface-container-lowest p-8 ambient-shadow"
                >
                  <item.icon className="text-primary mb-5" size={32} aria-hidden />
                  <h3 className="font-display text-xl text-on-surface mb-3">
                    {item.title}
                  </h3>
                  <p className="font-body text-on-surface-variant">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-16 rounded-xl bg-surface-container-lowest border border-outline-variant/30 p-8 md:p-10">
              <h3 className="font-display text-2xl text-primary mb-8">
                Specification
              </h3>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-6">
                {specificationRows(pricing).map(([term, detail]) => (
                  <div key={term} className="flex items-start gap-4">
                    <Check
                      size={20}
                      aria-hidden
                      className="text-secondary shrink-0 mt-1"
                    />
                    <div>
                      <dt className="font-body font-medium text-on-surface">
                        {term}
                      </dt>
                      <dd className="font-body text-on-surface-variant">
                        {detail}
                      </dd>
                    </div>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <HowItWorks />
      </main>
      <Footer />
    </>
  );
}
