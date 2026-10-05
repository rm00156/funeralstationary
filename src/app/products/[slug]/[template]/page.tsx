import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";

import Breadcrumb from "@/components/Breadcrumb";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import ProductCard from "@/components/ProductCard";
import TemplateBuyBox from "@/components/TemplateBuyBox";
import TemplateGallery from "@/components/TemplateGallery";
import { placeholderPortraitUrl } from "@/lib/backgroundAssets.server";
import {
  getCategories,
  getSellableProduct,
  getSellableProducts,
  getTemplateBySlug,
} from "@/lib/catalogue.server";
import { makeTemplateLayout, sizeText, toTemplateLayout } from "@/lib/designEditor";
import { copiesText, formatPence } from "@/lib/orderOfServicePricing";
import { portraitRotationForSeed, withPlaceholderPhotos } from "@/lib/placeholderPortraits";
import { getPricingData } from "@/lib/pricing.server";
import {
  DESIGN_FOR_YOU_HREF,
  ORDER_CUTOFF,
  PHONE_DISPLAY,
  PHONE_HREF,
  STANDARD_TURNAROUND,
} from "@/lib/site";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/storage";

// Pricing and the catalogue live in MySQL and are editable from /admin, so
// this page must render per-request rather than being frozen at build time.
export const dynamic = "force-dynamic";

/** The authored template pages, as the gallery names them, by how many there are. */
const VIEW_LABELS: Record<1 | 2 | 3, string[]> = {
  1: ["The design"],
  2: ["Front", "Back"],
  3: ["Front cover", "Inside pages", "Back cover"],
};

const IMAGE_TYPE_NAMES: Record<(typeof ALLOWED_IMAGE_TYPES)[number], string> = {
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "image/heic": "HEIC",
};

/**
 * A design belongs to exactly one product, so both halves of the URL have to
 * agree: an unknown design, an unpublished one, or one filed under a different
 * product is a 404 rather than a page that quotes the wrong prices.
 */
async function loadDesign(productSlug: string, templateSlug: string) {
  const [product, template] = await Promise.all([
    getSellableProduct(productSlug),
    getTemplateBySlug(templateSlug),
  ]);
  if (!product || !template || template.productId !== product.id) return null;
  return { product, template };
}

export async function generateMetadata({
  params,
}: PageProps<"/products/[slug]/[template]">): Promise<Metadata> {
  const { slug, template: templateSlug } = await params;
  const found = await loadDesign(slug, templateSlug);
  if (!found) return { title: "Not found | The Funeral Stationery" };
  const { product, template } = found;
  return {
    title: `${template.name} – ${product.label} | The Funeral Stationery`,
    description: `Personalise the ${template.name} design online with your own photographs and words. ${product.label} from ${formatPence(product.fromPence)} for ${copiesText(product.fromCopies)}, delivered anywhere in the UK.`,
  };
}

function listOf(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}

export default async function TemplatePage({
  params,
}: PageProps<"/products/[slug]/[template]">) {
  const { slug, template: templateSlug } = await params;
  const found = await loadDesign(slug, templateSlug);
  if (!found) notFound();
  const { product, template } = found;

  const [pricing, categories, products] = await Promise.all([
    getPricingData(product.id),
    getCategories(),
    getSellableProducts(),
  ]);
  const styles = categories.filter((category) => template.categories.includes(category.id));
  const otherProducts = products.filter((other) => other.id !== product.id).slice(0, 3);

  // The pages the editor would open for this design: its authored layout, or
  // the generic starter document when it has none. Photo windows are empty in
  // the stored layout, so they are filled with stand-in portraits for this
  // preview only — the same substitution the thumbnail renderer makes.
  const { format } = product;
  const layout =
    toTemplateLayout(template.layout, format.templatePages) ??
    makeTemplateLayout(template, format);
  const portraits = portraitRotationForSeed(template.id).map(placeholderPortraitUrl);
  const views = layout.map((page, index) => ({
    label: VIEW_LABELS[format.templatePages][index] ?? `Page ${index + 1}`,
    page: withPlaceholderPhotos(page, portraits),
  }));

  const productHref = `/products/${product.id}`;
  const details = [
    {
      title: `Size and ${format.paperLabel.toLowerCase()}`,
      body: (
        <>
          {format.sizedByOption ? (
            <p>
              Printed at the size you choose, from {format.sizeLabel.replace(" to ", " up to ")}.
              Every A size is the same shape, so your design scales up exactly as you made it.
            </p>
          ) : (
            <p>
              Exact {sizeText(format)}. Printed on heavyweight paper so it lasts as a keepsake.
            </p>
          )}
          {pricing.paper.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {pricing.paper.map((paper) => (
                <li key={paper.id}>
                  <strong className="font-semibold text-ink">{paper.label}</strong>
                  {paper.note && ` — ${paper.note}`}
                </li>
              ))}
            </ul>
          )}
        </>
      ),
    },
    {
      title: "Delivery and timings",
      body: (
        <>
          <ul className="flex flex-col gap-1.5">
            {pricing.delivery.map((option) => (
              <li key={option.id}>
                <strong className="font-semibold text-ink">
                  {option.label} ({option.pricePence === 0 ? "free" : formatPence(option.pricePence)})
                </strong>
                {option.note && ` — ${option.note}`}
              </li>
            ))}
          </ul>
          <p className="mt-3">
            The cut-off for next-working-day delivery is {ORDER_CUTOFF} on a working day, and
            standard turnaround is {STANDARD_TURNAROUND}. If the service is soon, please call us on{" "}
            <a href={PHONE_HREF} className="link">
              {PHONE_DISPLAY}
            </a>
            .
          </p>
        </>
      ),
    },
    {
      title: "Photos that print well",
      body: (
        <p>
          Upload {listOf(ALLOWED_IMAGE_TYPES.map((type) => IMAGE_TYPE_NAMES[type]))} files up to{" "}
          {Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB each. Use the original photograph where
          you can — pictures saved from social media or a messaging app are often too small to
          print sharply. You’ll see each photo on the page before you order.
        </p>
      ),
    },
  ];

  return (
    <>
      <Header />
      <main className="type-body flex-1">
        <section className="bg-paper">
          <div className="site-container flex flex-col gap-7 pb-20 pt-8 md:pb-24">
            <Breadcrumb
              items={[
                { label: "Home", href: "/" },
                { label: "Shop", href: "/shop" },
                { label: product.label, href: productHref },
                { label: template.name },
              ]}
            />

            <div className="flex flex-wrap items-start gap-x-14 gap-y-10">
              <div className="min-w-0 flex-[1.3_1_520px] lg:sticky lg:top-6">
                <TemplateGallery name={template.name} views={views} trim={format.trim} />
              </div>

              <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-7">
                <div className="flex flex-col gap-2.5">
                  <p className="text-sm font-semibold uppercase tracking-[0.12em] text-plum">
                    {product.label}
                  </p>
                  <h1 className="font-display text-[clamp(38px,3.8vw,50px)] font-normal leading-[1.08] text-ink text-balance">
                    {template.name}
                  </h1>
                  <p className="text-ink-2">
                    Personalise it online — their name and dates, your photographs and the
                    wording — then choose how many you need. We print it for you and deliver
                    anywhere in the UK.
                  </p>
                  {styles.length > 0 && (
                    <ul aria-label="Styles" className="flex flex-wrap gap-2 pt-1">
                      {styles.map((style) => (
                        <li key={style.id}>
                          <Link
                            href={`${productHref}?category=${style.id}`}
                            className="inline-flex min-h-11 items-center rounded-full border border-line-2 bg-surface px-4 text-[15px] text-ink-2 no-underline transition-colors hover:border-plum hover:text-plum"
                          >
                            {style.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <TemplateBuyBox
                  productId={product.id}
                  templateId={template.id}
                  pricing={pricing}
                  format={format}
                />

                <p className="text-base text-ink-2">
                  Rather we did it for you?{" "}
                  <Link href={DESIGN_FOR_YOU_HREF} className="link font-medium">
                    Send us the photos and words
                  </Link>{" "}
                  or call{" "}
                  <a href={PHONE_HREF} className="link font-medium">
                    {PHONE_DISPLAY}
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-surface">
          <div className="site-container grid grid-cols-[repeat(auto-fit,minmax(min(420px,100%),1fr))] items-start gap-12 py-20">
            <div className="flex flex-col gap-5">
              <h2 className="type-sub">What you can personalise</h2>
              <ul className="flex flex-col gap-3">
                {[
                  "Their name, dates, and the date and place of the service",
                  format.templatePages === 3
                    ? "The cover photograph, and the photos inside"
                    : "The photographs, and where they sit",
                  "All of the wording, on every page",
                  pricing.pages.length > 1 && !format.sizedByOption
                    ? "The number of pages, to fit everything you want to include"
                    : "The fonts and colours of the text",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check size={22} aria-hidden className="mt-[3px] shrink-0 text-plum" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col border-t border-line-2">
              {details.map((detail, index) => (
                <details key={detail.title} open={index === 0} className="group border-b border-line-2">
                  <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between font-semibold [&::-webkit-details-marker]:hidden">
                    {detail.title}
                    <ChevronDown
                      size={20}
                      aria-hidden
                      className="shrink-0 transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <div className="pb-5 text-ink-2">{detail.body}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {otherProducts.length > 0 && (
          <section className="bg-paper">
            <div className="site-container flex flex-col gap-8 pb-24 pt-20">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h2 className="type-sub">You may also need</h2>
                <Link href="/shop" className="link flex min-h-11 items-center font-medium">
                  See everything
                </Link>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-6">
                {otherProducts.map((other) => (
                  <ProductCard key={other.id} product={other} compact />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
