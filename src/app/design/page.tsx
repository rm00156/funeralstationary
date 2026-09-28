import type { Metadata } from "next";

import DesignEditor from "@/components/DesignEditor";
import { getProducts, getTemplateBySlug, getTemplates } from "@/lib/catalogue.server";
import { getDesign } from "@/lib/designs.server";
import { parseCarriedSelection, type Selection } from "@/lib/orderOfServicePricing";
import { getPricingData } from "@/lib/pricing.server";
import { readOwner } from "@/lib/session";

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

  // ?design=<id> is the canonical address for an existing design and is
  // authoritative on its own: the row owns its template and product, and both
  // can change from inside the editor. ?template=/?product= only seed a *new*
  // design (the link /templates builds); the editor strips them from the URL
  // as soon as a design id exists.
  const owner = designParam ? await readOwner() : null;
  const saved = owner && designParam ? await getDesign(owner, designParam) : null;

  const [templates, products] = await Promise.all([getTemplates(), getProducts()]);
  const template =
    templates.find((item) => item.id === (saved ? saved.templateId : templateParam)) ??
    templates[0];
  const product =
    products.find((item) => item.id === (saved ? saved.productId : productParam)) ??
    products[0];
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
      templates={templates}
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
