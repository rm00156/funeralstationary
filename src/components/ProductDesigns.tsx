"use client";

import { useMemo, useState } from "react";

import TemplateCard from "@/components/TemplateCard";
import type { PageTrim } from "@/lib/designEditor";
import type { Template, TemplateCategory } from "@/lib/templates";

/** Designs shown before "Show more designs" — three rows of four at full width. */
const PAGE_SIZE = 12;

/**
 * A product's designs: a sticky bar of style chips with a live count, the
 * grid, and "Show more". Styles are a filter *inside* a product — only the
 * categories this product's designs actually use get a chip — and filtering
 * happens in the browser, since the whole list is already on the page.
 */
export default function ProductDesigns({
  productId,
  templates,
  trim,
  categories,
  initialCategoryId = null,
  priceLine,
}: {
  productId: string;
  /** This product's published designs, in sort order. */
  templates: Template[];
  /** The product's trim — what shape its covers are. */
  trim: PageTrim;
  /** The categories those designs use, in sort order. */
  categories: TemplateCategory[];
  /** ?category= from the URL, already validated server-side. */
  initialCategoryId?: string | null;
  /** e.g. "from £33.00" — every design in a product costs the same. */
  priceLine: string;
}) {
  const [categoryId, setCategoryId] = useState<string | null>(initialCategoryId);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const categoryLabels = useMemo(
    () => new Map(categories.map((category) => [category.id, category.label])),
    [categories],
  );
  const matching = useMemo(
    () =>
      categoryId === null
        ? templates
        : templates.filter((template) => template.categories.includes(categoryId)),
    [templates, categoryId],
  );
  const shown = matching.slice(0, limit);

  const pick = (id: string | null) => {
    setCategoryId(id);
    setLimit(PAGE_SIZE);
  };

  return (
    <>
      <div className="sticky top-0 z-10 bg-paper">
        <div className="site-container">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line py-4">
            <div
              role="group"
              aria-label="Filter designs"
              className="-mx-margin-mobile flex gap-2.5 overflow-x-auto px-margin-mobile sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
            >
              <button
                type="button"
                className="chip shrink-0"
                aria-pressed={categoryId === null}
                onClick={() => pick(null)}
              >
                All designs
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className="chip shrink-0"
                  aria-pressed={categoryId === category.id}
                  onClick={() => pick(category.id)}
                >
                  {category.label}
                </button>
              ))}
            </div>
            <p aria-live="polite" className="text-[15px] text-ink-3">
              Showing {shown.length} of {matching.length}{" "}
              {matching.length === 1 ? "design" : "designs"}
            </p>
          </div>
        </div>
      </div>

      <div className="site-container grid grid-cols-[repeat(auto-fill,minmax(min(240px,100%),1fr))] gap-x-7 gap-y-10 pb-16 pt-10">
        {shown.map((template, index) => (
          <TemplateCard
            key={template.id}
            trim={trim}
            href={`/products/${productId}/${template.id}`}
            name={template.name}
            image={template.image}
            priority={index < 4}
            meta={[
              categoryLabels.get(
                categoryId && template.categories.includes(categoryId)
                  ? categoryId
                  : template.categories[0],
              ),
              priceLine,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
        ))}
      </div>

      {matching.length > shown.length && (
        <div className="flex justify-center px-margin-mobile pb-24">
          <button
            type="button"
            className="btn btn-outline px-7 text-[17px]"
            onClick={() => setLimit((current) => current + PAGE_SIZE)}
          >
            Show more designs
          </button>
        </div>
      )}
      {matching.length <= shown.length && <div className="pb-8" />}
    </>
  );
}
