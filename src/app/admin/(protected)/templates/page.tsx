import Image from "next/image";
import Link from "next/link";
import { Pencil } from "lucide-react";

import AdminTemplateCreateForm from "@/components/AdminTemplateCreateForm";
import {
  adminListProducts,
  adminListTemplates,
} from "@/lib/adminCatalogue.server";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  published: "bg-soft-sage text-secondary",
  draft: "bg-surface-container text-on-surface-variant",
  archived: "bg-surface-container-high text-outline",
};

export default async function AdminTemplatesPage() {
  const [templates, products] = await Promise.all([
    adminListTemplates(),
    adminListProducts(),
  ]);
  const productLabels = new Map(products.map((product) => [product.slug, product.label]));

  return (
    <>
      <h1 className="mb-2 font-display text-3xl font-semibold text-primary">Templates</h1>
      <p className="mb-8 max-w-2xl font-body text-on-surface-variant">
        The template catalogue. Draft and archived templates are hidden from
        customers; open a template to edit its details or author its layout.
      </p>

      <div className="mb-8 overflow-x-auto rounded-xl border border-outline-variant/30 bg-surface-container-lowest ambient-shadow">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="border-b border-outline-variant/40 font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary">
              <th className="px-5 py-3">Template</th>
              <th className="px-5 py-3">Product</th>
              <th className="px-5 py-3">Categories</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Sort</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => (
              <tr
                key={template.slug}
                className="border-b border-outline-variant/20 font-body text-sm text-on-surface last:border-b-0"
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="relative block h-14 w-11 shrink-0 overflow-hidden rounded-md bg-surface-container-low">
                      <Image
                        src={template.previewImageUrl}
                        alt=""
                        fill
                        sizes="44px"
                        className="object-contain p-0.5"
                      />
                    </span>
                    <span>
                      <span className="block font-medium">{template.name}</span>
                      <span className="block text-xs text-on-surface-variant">
                        {template.slug}
                      </span>
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3 text-on-surface-variant">
                  {productLabels.get(template.productSlug) ?? template.productSlug}
                </td>
                <td className="px-5 py-3 text-on-surface-variant">
                  {template.categories.join(", ") || "—"}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-3 py-1 font-body text-xs font-medium capitalize ${
                      STATUS_STYLES[template.status] ?? STATUS_STYLES.draft
                    }`}
                  >
                    {template.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-on-surface-variant">{template.sortOrder}</td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`/admin/templates/${template.slug}`}
                    className="inline-flex items-center gap-2 rounded-lg border-2 border-primary-container px-4 py-1.5 font-medium text-primary-container transition-colors duration-300 hover:bg-surface-container"
                  >
                    <Pencil size={14} aria-hidden />
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdminTemplateCreateForm products={products} />
    </>
  );
}
