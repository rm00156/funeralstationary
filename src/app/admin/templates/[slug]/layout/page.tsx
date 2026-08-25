import { notFound } from "next/navigation";

import DesignEditor from "@/components/DesignEditor";
import {
  adminGetProduct,
  adminGetTemplate,
  adminListCategories,
} from "@/lib/adminCatalogue.server";
import { requireAdmin } from "@/lib/adminSession";
import { getPricingData } from "@/lib/pricing.server";
import type { Template } from "@/lib/templates";

export const dynamic = "force-dynamic";

/**
 * The template layout authoring surface: the same editor customers use,
 * mounted in templateAuthoring mode so saves write templates.layout. This
 * page deliberately sits OUTSIDE the (protected) route group — the editor is
 * full-bleed (h-dvh) and the admin chrome would fight it — so it calls
 * requireAdmin() itself.
 */
export default async function AdminTemplateLayoutPage({
  params,
}: PageProps<"/admin/templates/[slug]/layout">) {
  await requireAdmin();

  const { slug } = await params;
  const [template, categories] = await Promise.all([
    adminGetTemplate(slug),
    adminListCategories(),
  ]);
  if (!template) notFound();

  const [product, pricing] = await Promise.all([
    adminGetProduct(template.productSlug),
    getPricingData(template.productSlug),
  ]);
  if (!product) notFound();

  const editorTemplate: Template = {
    id: template.slug,
    name: template.name,
    categories: template.categories,
    productId: template.productSlug,
    image: template.previewImageUrl,
    accent: categories.find((category) => category.slug === template.categories[0])
      ?.accentHex,
  };

  return (
    <DesignEditor
      template={editorTemplate}
      productId={template.productSlug}
      productLabel={product.label}
      templates={[]}
      pricing={pricing}
      templateAuthoring={{ slug: template.slug, initialPages: template.layout }}
    />
  );
}
