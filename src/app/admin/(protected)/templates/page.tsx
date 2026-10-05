import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Pencil, Search } from "lucide-react";

import AdminTemplateCreateForm from "@/components/AdminTemplateCreateForm";
import {
  adminListCategories,
  adminListProducts,
  adminListTemplates,
  type AdminProduct,
  type AdminTemplate,
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
  searchParams: Promise<{ product?: string; category?: string; q?: string }>;
}) {
  const [{ product: productParam, category: categoryParam, q }, allTemplates, products, categories] =
    await Promise.all([
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
  // An unknown product slug falls back to the product list.
  const product = products.find((candidate) => candidate.slug === productParam);
  // Neither a product nor a search: pick the product first.
  if (!product && !query) {
    return <ProductIndex products={products} templates={allTemplates} />;
  }

  // A search without a product spans every product.
  const inScope = product
    ? allTemplates.filter((template) => template.productSlug === product.slug)
    : allTemplates;
  const needle = query.toLowerCase();
  // The search narrows the category counts too, so each pill says what clicking it shows.
  const searched = needle
    ? inScope.filter(
        (template) =>
          template.name.toLowerCase().includes(needle) ||
          template.slug.includes(needle),
      )
    : inScope;
  const templates = category
    ? searched.filter((template) => template.categories.includes(category))
    : searched;
  const countFor = (slug: string) =>
    searched.filter((template) => template.categories.includes(slug)).length;
  // Only the categories this scope uses, so a three-template product isn't a row of zeros.
  const shownCategories = categories.filter(
    (candidate) => candidate.slug === category || countFor(candidate.slug) > 0,
  );
  const filterHref = (categorySlug?: string) => {
    const params = new URLSearchParams();
    if (product) params.set("product", product.slug);
    if (categorySlug) params.set("category", categorySlug);
    if (query) params.set("q", query);
    const search = params.toString();
    return search ? `/admin/templates?${search}` : "/admin/templates";
  };

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
        <span className="text-on-surface">{product ? product.label : "Search"}</span>
      </nav>

      <h1 className="mb-2 font-display text-3xl font-medium text-primary">
        {product ? product.label : "Templates"}
      </h1>
      <p className="mb-6 max-w-2xl font-body text-on-surface-variant">
        {product
          ? `Every ${product.label} template, in any status. Open one to edit its details or author its layout.`
          : `Templates in every product matching “${query}”.`}
      </p>

      <SearchForm query={query} product={product?.slug} category={category} clearHref={filterHref(category)} />

      <nav aria-label="Filter by category" className="mb-6 flex flex-wrap gap-2">
        <FilterLink href={filterHref()} active={!category}>
          All ({searched.length})
        </FilterLink>
        {shownCategories.map((candidate) => (
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
              {!product && <th className="px-5 py-3">Product</th>}
              <th className="px-5 py-3">Categories</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Sort</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 && (
              <tr>
                <td colSpan={product ? 5 : 6} className="px-5 py-8 text-center font-body text-sm text-on-surface-variant">
                  {query
                    ? `No templates match “${query}”.`
                    : category
                      ? "No templates in this category yet."
                      : "No templates for this product yet."}
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
                {!product && (
                  <td className="px-5 py-3 text-on-surface-variant">
                    {productLabels.get(template.productSlug) ?? template.productSlug}
                  </td>
                )}
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

      <AdminTemplateCreateForm
        key={product?.slug}
        products={products}
        defaultProduct={product?.slug}
      />
    </>
  );
}

/** The landing view: one tile per product, each opening that product's templates. */
function ProductIndex({
  products,
  templates,
}: {
  products: AdminProduct[];
  templates: AdminTemplate[];
}) {
  return (
    <>
      <h1 className="mb-2 font-display text-3xl font-medium text-primary">Templates</h1>
      <p className="mb-6 max-w-2xl font-body text-on-surface-variant">
        The template catalogue, by product. Draft and archived templates are
        hidden from customers; open a product to see its templates, then a
        template to edit its details or author its layout. Layout edits save to
        a draft and only reach customers once published.
      </p>

      <SearchForm query="" />

      <ul className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => {
          // adminListTemplates is sorted, so the first is the one that leads.
          const own = templates.filter((template) => template.productSlug === product.slug);
          const published = own.filter((template) => template.status === "published").length;
          const drafts = own.filter((template) => template.status === "draft").length;
          const unpublishedLayouts = own.filter((template) => template.hasDraftLayout).length;
          const cover = own[0]?.previewImageUrl;
          return (
            <li key={product.slug}>
              <Link
                href={`/admin/templates?product=${product.slug}`}
                className="flex h-full items-center gap-4 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 ambient-shadow transition-colors duration-300 hover:border-primary-container/50"
              >
                <span className="relative block h-24 w-[4.5rem] shrink-0 overflow-hidden rounded-md bg-surface-container-low">
                  {cover && (
                    <Image src={cover} alt="" fill sizes="72px" className="object-contain p-0.5" />
                  )}
                </span>
                <span className="min-w-0 flex-1 font-body">
                  <span className="block font-medium text-on-surface">{product.label}</span>
                  <span className="block text-sm text-on-surface-variant">
                    {own.length} {own.length === 1 ? "template" : "templates"}
                  </span>
                  <span className="mt-1 block text-xs text-on-surface-variant">
                    {published} published · {drafts} draft
                    {unpublishedLayouts > 0 && ` · ${unpublishedLayouts} unpublished layout`}
                  </span>
                  {!product.isActive && (
                    <span className="mt-2 inline-block rounded-full bg-surface-container-high px-3 py-0.5 text-xs font-medium text-outline">
                      Inactive
                    </span>
                  )}
                </span>
                <ChevronRight size={18} aria-hidden className="shrink-0 text-on-surface-variant" />
              </Link>
            </li>
          );
        })}
      </ul>

      <AdminTemplateCreateForm products={products} />
    </>
  );
}

function SearchForm({
  query,
  product,
  category,
  clearHref,
}: {
  query: string;
  product?: string;
  category?: string;
  clearHref?: string;
}) {
  return (
    <form role="search" action="/admin/templates" className="mb-4 flex max-w-xl flex-wrap items-center gap-2">
      <label htmlFor="template-search" className="sr-only">
        Search templates
      </label>
      <input
        id="template-search"
        type="search"
        name="q"
        defaultValue={query}
        placeholder={product ? "Search this product by name or slug" : "Search every product by name or slug"}
        className="field min-w-0 flex-1"
      />
      {product && <input type="hidden" name="product" value={product} />}
      {category && <input type="hidden" name="category" value={category} />}
      <button type="submit" className="btn btn-primary">
        <Search size={18} aria-hidden />
        Search
      </button>
      {query && clearHref && (
        <Link href={clearHref} className="link font-body text-sm">
          Clear
        </Link>
      )}
    </form>
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
