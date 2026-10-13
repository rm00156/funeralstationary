import type { Metadata } from "next";
import { notFound } from "next/navigation";

import DesignEditor from "@/components/DesignEditor";
import { requireAdmin } from "@/lib/adminAuth.server";
import { designOwnerLabel } from "@/lib/adminDesigns";
import { adminGetDesign } from "@/lib/adminDesigns.server";
import {
  getProductFormats,
  getProductLabels,
  getTemplateForDesign,
  getTemplates,
} from "@/lib/catalogue.server";
import { customerHref } from "@/lib/adminCustomers";
import { getPricingData } from "@/lib/pricing.server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit a customer’s design | Admin",
  robots: { index: false, follow: false },
};

/**
 * An admin editing a customer's design on their behalf — the customer's own
 * editor, on the customer's own design, saving through
 * PATCH /api/admin/designs/:id. Like the template-authoring page it sits
 * outside the (protected) group, since the editor is full-bleed, so it calls
 * requireAdmin() itself.
 */
export default async function AdminDesignEditorPage({ params }: PageProps<"/admin/designs/[id]">) {
  await requireAdmin();

  const { id } = await params;
  const detail = await adminGetDesign(id);
  if (!detail) notFound();
  const { design, owner, orderState } = detail;

  // Its own template and product, whatever their status now — opening it on
  // another would re-point the design on the first save.
  const [template, templates, formats, labels, pricing] = await Promise.all([
    getTemplateForDesign(design.templateId),
    getTemplates(),
    getProductFormats(),
    getProductLabels(),
    getPricingData(design.productId),
  ]);
  const format = formats.get(design.productId);
  if (!template || !format) notFound();

  return (
    <DesignEditor
      template={template}
      productId={design.productId}
      productLabel={labels.get(design.productId) ?? design.productLabel}
      format={format}
      templates={templates.filter((item) => item.productId === design.productId)}
      pricing={pricing}
      adminEditing={{
        ownerLabel: designOwnerLabel(owner),
        backHref: owner ? customerHref(owner.email) : "/admin/designs",
        orderState,
      }}
      savedDesign={{
        id: design.id,
        name: design.name,
        doc: design.doc,
        pagesOptionId: design.pagesOptionId,
        paperId: design.paperId,
        revision: design.revision,
      }}
    />
  );
}
