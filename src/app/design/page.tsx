import type { Metadata } from "next";

import DesignEditor from "@/components/DesignEditor";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import ShopClosedNotice from "@/components/ShopClosedNotice";
import {
  getProducts,
  getTemplateBySlug,
  getTemplateForDesign,
  getTemplates,
} from "@/lib/catalogue.server";
import { getDesign } from "@/lib/designs.server";
import { parseCarriedSelection, type Selection } from "@/lib/orderOfServicePricing";
import { getPricingData } from "@/lib/pricing.server";
import { readOwner } from "@/lib/session";
import { isShopOpen } from "@/lib/siteBilling.server";
import type { Product, Template } from "@/lib/templates";

// The catalogue lives in MySQL and is editable from /admin, so this page
// must render per-request rather than being frozen at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Design Your Stationery | The Funeral Stationery",
  description:
    "Personalise your funeral stationery in our online editor — edit the wording, add photographs, and preview every page before you order.",
};

export default async function DesignPage({
  searchParams,
}: {
  searchParams: Promise<
    { template?: string; product?: string; design?: string } & Partial<Selection>
  >;
}) {
  const {
    template: templateParam,
    product: productParam,
    design: designParam,
    ...carriedParams
  } = await searchParams;

  // The site's subscription is unpaid: no designing (the routes refuse a save anyway).
  if (!(await isShopOpen())) {
    return (
      <>
        <Header />
        <main className="type-body flex-1">
          <div className="site-container pb-24 pt-14">
            <h1 className="type-page mb-8">Design your stationery</h1>
            <ShopClosedNotice />
          </div>
        </main>
        <Footer />
      </>
    );
  }

  // ?design=<id> is the canonical address for an existing design and is
  // authoritative on its own: the row owns its template and product, and both
  // can change from inside the editor. ?template=/?product= only seed a *new*
  // design (the link a design's page builds); the editor strips them from the URL
  // as soon as a design id exists.
  const owner = designParam ? await readOwner() : null;
  const saved = owner && designParam ? await getDesign(owner, designParam) : null;

  const [templates, products] = await Promise.all([getTemplates(), getProducts()]);
  const hasTemplates = (productId: string) => templates.some((item) => item.productId === productId);

  let template: Template | undefined;
  let product: Product | undefined;
  if (saved) {
    // A saved design opens on its own template even once that is archived —
    // falling back to another (possibly another product's) would re-point
    // the design on its next save, or have every save refused.
    product =
      products.find((item) => item.id === saved.productId) ??
      products.find((item) => item.id === productParam) ??
      products[0];
    template =
      templates.find((item) => item.id === saved.templateId) ??
      (await getTemplateForDesign(saved.templateId)) ??
      undefined;
  } else {
    // A template belongs to exactly one product, and its layout is drawn on
    // that product's trim — so a new design's product is its template's,
    // never a ?product= that disagrees with it. Without a usable template,
    // ?product= still picks the product, and the design starts on its first.
    const requested = templates.find((item) => item.id === templateParam);
    product =
      products.find((item) => item.id === requested?.productId) ??
      products.find((item) => item.id === productParam && hasTemplates(item.id)) ??
      products.find((item) => hasTemplates(item.id));
    template =
      requested?.productId === product?.id
        ? requested
        : templates.find((item) => item.productId === product?.id);
  }
  if (!template || !product) {
    throw new Error("The catalogue is empty — run `npm run db:seed` first.");
  }

  // The template's authored layout (templates.layout) seeds a NEW design's
  // starter document; a saved design already carries its own doc.
  const [pricing, templateWithLayout] = await Promise.all([
    getPricingData(product.id),
    saved ? null : getTemplateBySlug(template.id),
  ]);
  // The options picked on the product page. Pages and paper belong to the
  // design, so they only seed a new one; copies and delivery are basket-line
  // choices and ride along to "Add to basket" either way.
  const carried = parseCarriedSelection(pricing, carriedParams);
  const initialSelection: Partial<Selection> = saved
    ? { quantity: carried.quantity, delivery: carried.delivery }
    : carried;

  return (
    <DesignEditor
      template={template}
      productId={product.id}
      productLabel={product.label}
      format={product.format}
      templates={templates.filter((item) => item.productId === product.id)}
      pricing={pricing}
      initialLayout={templateWithLayout?.layout ?? null}
      initialSelection={initialSelection}
      savedDesign={
        saved
          ? {
              id: saved.id,
              name: saved.name,
              doc: saved.doc,
              pagesOptionId: saved.pagesOptionId,
              paperId: saved.paperId,
            }
          : undefined
      }
    />
  );
}
