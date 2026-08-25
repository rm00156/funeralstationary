import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, PenTool } from "lucide-react";

import AdminTemplateForm from "@/components/AdminTemplateForm";
import AdminTemplateLayoutActions from "@/components/AdminTemplateLayoutActions";
import {
  adminGetTemplate,
  adminListCategories,
  adminListProducts,
} from "@/lib/adminCatalogue.server";

export const dynamic = "force-dynamic";

export default async function AdminTemplatePage({
  params,
}: PageProps<"/admin/templates/[slug]">) {
  const { slug } = await params;
  const [template, products, categories] = await Promise.all([
    adminGetTemplate(slug),
    adminListProducts(),
    adminListCategories(),
  ]);
  if (!template) notFound();

  return (
    <>
      <nav
        aria-label="Breadcrumb"
        className="mb-6 flex items-center gap-2 font-body text-sm text-on-surface-variant"
      >
        <Link href="/admin/templates" className="transition-colors hover:text-primary">
          Templates
        </Link>
        <ChevronRight size={14} aria-hidden />
        <span className="text-on-surface">{template.name}</span>
      </nav>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {template.name}
          </h1>
          {template.hasDraftLayout && (
            <p className="mt-2 font-body text-sm text-on-surface-variant">
              This layout has unpublished changes — customers still see
              {template.layout ? " the published version." : " the generic starter pages."}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AdminTemplateLayoutActions
            slug={template.slug}
            hasLayout={!!template.layout}
            hasDraftLayout={template.hasDraftLayout}
          />
          <Link
            href={`/admin/templates/${template.slug}/layout`}
            className="flex items-center gap-2 rounded-lg bg-secondary px-5 py-2.5 font-body text-sm font-medium text-on-secondary transition-colors duration-300 hover:bg-on-secondary-container"
          >
            <PenTool size={16} aria-hidden />
            {template.layout || template.draftLayout ? "Edit layout" : "Author layout"}
          </Link>
        </div>
      </div>

      <AdminTemplateForm
        template={template}
        products={products}
        categories={categories}
      />
    </>
  );
}
