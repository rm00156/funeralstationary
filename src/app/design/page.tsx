import type { Metadata } from "next";

import DesignEditor from "@/components/DesignEditor";
import { DEFAULT_PRODUCT, PRODUCTS, TEMPLATES } from "@/lib/templates";

export const metadata: Metadata = {
  title: "Design Your Stationery | The Funeral Stationery",
  description:
    "Personalise your funeral stationery in our online editor — edit the wording, add photographs, and preview every page before you order.",
};

export default async function DesignPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string; product?: string }>;
}) {
  const { template: templateParam, product: productParam } = await searchParams;
  const template =
    TEMPLATES.find((item) => item.id === templateParam) ?? TEMPLATES[0];
  const product =
    PRODUCTS.find((item) => item.id === productParam) ??
    PRODUCTS.find((item) => item.id === DEFAULT_PRODUCT)!;

  return <DesignEditor template={template} productLabel={product.label} />;
}
