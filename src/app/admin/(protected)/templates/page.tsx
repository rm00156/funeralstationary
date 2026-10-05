import Image from "next/image";
import Link from "next/link";
import { Pencil, Search } from "lucide-react";

import AdminTemplateCreateForm from "@/components/AdminTemplateCreateForm";
import {
  adminListCategories,
  adminListProducts,
  adminListTemplates,
} from "@/lib/adminCatalogue.server";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  published: "bg-soft-sage text-secondary",
  draft: "bg-surface-container text-on-surface-variant",
  archived: "bg-surface-container-high text-outline",
};

export default async function AdminTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const [{ category: categoryParam, q }, allTemplates, products, categories] = await Promise.all([
    searchParams,
    adminListTemplates(),
    adminListProducts(),
    adminListCategories(),
  ]);
  const productLabels = new Map(products.map((product) => [product.slug, product.label]));
  // An unknown slug shows everything rather than an empty table.
  const category = categories.some((candidate) => candidate.slug === categoryParam)
    ? categoryParam
    : undefined;
  const query = q?.trim() ?? "";
  const needle = query.toLowerCase();
  // The search narrows the category counts too, so each pill says what clicking it shows.
  const searched = needle
    ? allTemplates.filter(
        (template) =>
          template.name.toLowerCase().includes(needle) ||
          template.slug.includes(needle),
      )
    : allTemplates;
  const templates = category
    ? searched.filter((template) => template.categories.includes(category))
    : searched;
  const countFor = (slug: string) =>
    searched.filter((template) => template.categories.includes(slug)).length;
  const filterHref = (categorySlug?: string) => {
    const params = new URLSearchParams();
    if (categorySlug) params.set("category", categorySlug);
    if (query) params.set("q", query);
    const search = params.toString();
    return search ? `/admin/templates?${search}` : "/admin/templates";
  };

  return (
    <>
      <h1 className="mb-2 font-display text-3xl font-medium text-primary">Templates</h1>
      <p className="mb-6 max-w-2xl font-body text-on-surface-variant">
        The template catalogue. Draft and archived templates are hidden from
        customers; open a template to edit its details or author its layout.
        Layout edits save to a draft and only reach customers once published.
      </p>

      <form role="search" action="/admin/templates" className="mb-4 flex max-w-xl flex-wrap items-center gap-2">
        <label htmlFor="template-search" className="sr-only">
          Search templates
        </label>
        <input
          id="template-search"
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search by name or slug"
          className="field min-w-0 flex-1"
        />
        {category && <input type="hidden" name="category" value={category} />}
        <button type="submit" className="btn btn-primary">
          <Search size={18} aria-hidden />
          Search
        </button>
        {query && (
          <Link href={filterHref(category)} className="link font-body text-sm">
            Clear
          </Link>
        )}
      </form>

      <nav aria-label="Filter by category" className="mb-6 flex flex-wrap gap-2">
        <FilterLink href={filterHref()} active={!category}>
          All ({searched.length})
        </FilterLink>
        {categories.map((candidate) => (
          <FilterLink
            key={candidate.slug}
            href={filterHref(candidate.slug)}
            active={category === candidate.slug}
          >
            {candidate.label} ({countFor(candidate.slug)})
          </FilterLink>
        ))}
      </nav>

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
            {templates.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center font-body text-sm text-on-surface-variant">
                  {query
                    ? `No templates match “${query}”.`
                    : category
                      ? "No templates in this category yet."
                      : "No templates yet."}
                </td>
              </tr>
            )}
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
                  {template.hasDraftLayout && (
                    <span className="mt-1 block text-xs text-on-surface-variant">
                      Unpublished layout
                    </span>
                  )}
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

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-full px-3 py-1 font-body text-xs font-medium transition-colors duration-300 ${
        active
          ? "bg-primary-container text-white"
          : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
      }`}
    >
      {children}
    </Link>
  );
}
