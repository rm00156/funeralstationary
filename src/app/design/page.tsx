import type { Metadata } from "next";

import DesignEditor from "@/components/DesignEditor";
import { getDesign } from "@/lib/designs.server";
import { readOwner } from "@/lib/session";
import { DEFAULT_PRODUCT, PRODUCTS, TEMPLATES } from "@/lib/templates";

export const metadata: Metadata = {
  title: "Design Your Stationery | The Funeral Stationery",
  description:
    "Personalise your funeral stationery in our online editor — edit the wording, add photographs, and preview every page before you order.",
};

export default async function DesignPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string; product?: string; design?: string }>;
}) {
  const {
    template: templateParam,
    product: productParam,
    design: designParam,
  } = await searchParams;

  // ?design=<id> is the canonical address for an existing design and is
  // authoritative on its own: the row owns its template and product, and both
  // can change from inside the editor. ?template=/?product= only seed a *new*
  // design (the link /templates builds); the editor strips them from the URL
  // as soon as a design id exists.
  const owner = designParam ? await readOwner() : null;
  const saved = owner && designParam ? await getDesign(owner, designParam) : null;

  const template =
    TEMPLATES.find((item) => item.id === (saved ? saved.templateId : templateParam)) ??
    TEMPLATES[0];
  const product =
    PRODUCTS.find((item) => item.id === (saved ? saved.productId : productParam)) ??
    PRODUCTS.find((item) => item.id === DEFAULT_PRODUCT)!;

  return (
    <DesignEditor
      template={template}
      productId={product.id}
      productLabel={product.label}
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
