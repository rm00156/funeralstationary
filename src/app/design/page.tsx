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

  // Reopening a saved design: its own template/product win over the query
  // string, so a shared link always renders what was actually saved.
  const owner = designParam ? await readOwner() : null;
  const saved = owner && designParam ? await getDesign(owner, designParam) : null;

  const template =
    TEMPLATES.find((item) => item.id === (saved?.templateId ?? templateParam)) ??
    TEMPLATES[0];
  const product =
    PRODUCTS.find((item) => item.id === (saved?.productId ?? productParam)) ??
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
