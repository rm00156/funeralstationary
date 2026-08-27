"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, Heart } from "lucide-react";

import {
  filterTemplates,
  type Product,
  type Template,
  type TemplateCategory,
} from "@/lib/templates";

export default function TemplateBrowser({
  products,
  categories,
  templates: allTemplates,
  initialProductId = null,
  initialCategoryId = null,
}: {
  products: Product[];
  categories: TemplateCategory[];
  templates: Template[];
  /** ?product= / ?category= from the URL, already validated server-side. */
  initialProductId?: string | null;
  initialCategoryId?: string | null;
}) {
  const [productId, setProductId] = useState(
    initialProductId ?? products[0]?.id ?? "",
  );
  const [categoryId, setCategoryId] = useState<string | null>(initialCategoryId);
  const [favourites, setFavourites] = useState<string[]>([]);

  const templates = useMemo(
    () => filterTemplates(allTemplates, productId, categoryId),
    [allTemplates, productId, categoryId],
  );

  const toggleFavourite = (id: string) =>
    setFavourites((current) =>
      current.includes(id)
        ? current.filter((favourite) => favourite !== id)
        : [...current, id],
    );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8 lg:gap-10 items-start">
      <aside className="lg:sticky lg:top-28 rounded-xl border border-soft-sage bg-surface-container-lowest p-6 ambient-shadow">
        <label
          htmlFor="template-product"
          className="block font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary mb-2"
        >
          Product
        </label>
        <div className="relative mb-6">
          <select
            id="template-product"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            className="w-full appearance-none rounded-lg bg-surface-container-low px-4 py-3 pr-10 font-body text-sm font-medium text-primary border border-outline-variant transition-colors duration-300 hover:bg-surface-container focus:border-primary-container focus:outline-none focus:ring-4 focus:ring-primary-container/15"
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            aria-hidden
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-outline"
          />
        </div>

        <h2 className="font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary mb-2">
          Category
        </h2>
        <nav aria-label="Template categories" className="flex flex-col gap-1">
          <CategoryLink
            label="All designs"
            selected={categoryId === null}
            onClick={() => setCategoryId(null)}
          />
          {categories.map((category) => (
            <CategoryLink
              key={category.id}
              label={category.label}
              selected={categoryId === category.id}
              onClick={() =>
                setCategoryId((current) =>
                  current === category.id ? null : category.id,
                )
              }
            />
          ))}
        </nav>

        <div className="mt-6 pt-6 border-t border-outline-variant/40 flex flex-col gap-3">
          <Link
            href="/#contact"
            className="rounded-lg bg-secondary px-4 py-2.5 text-center font-body text-sm font-medium tracking-wide text-on-secondary transition-colors duration-300 hover:bg-on-secondary-container"
          >
            Design it for me
          </Link>
          <Link
            href="/#contact"
            className="rounded-lg border-2 border-secondary px-4 py-2.5 text-center font-body text-sm font-medium tracking-wide text-secondary transition-colors duration-300 hover:bg-soft-sage"
          >
            Request a template
          </Link>
        </div>
      </aside>

      <div>
        <p
          aria-live="polite"
          className="mb-4 font-body text-sm uppercase tracking-[0.18em] text-secondary"
        >
          {templates.length} {templates.length === 1 ? "design" : "designs"}
        </p>

        {templates.length === 0 ? (
          <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-10 text-center">
            <p className="font-display text-xl text-primary mb-2">
              Nothing in this category yet
            </p>
            <p className="font-body text-on-surface-variant">
              Try another category, or ask us for it &mdash; we will design a
              new template to match, free of charge.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">
            {templates.map((template) => (
              <article
                key={template.id}
                className="flex flex-col rounded-xl border border-outline-variant/30 bg-surface-container-lowest overflow-hidden ambient-shadow transition-transform duration-300 hover:-translate-y-1"
              >
                <div className="relative w-full aspect-3/4 bg-surface-container-low">
                  <Image
                    src={template.image}
                    alt={`${template.name} template preview`}
                    fill
                    sizes="(min-width: 1280px) 25vw, (min-width: 640px) 33vw, 100vw"
                    className="object-contain p-4"
                  />
                </div>

                <div className="flex items-start justify-between gap-3 px-5 pt-5">
                  <h3 className="font-display text-lg text-on-surface">
                    {template.name}
                  </h3>
                  <button
                    type="button"
                    onClick={() => toggleFavourite(template.id)}
                    aria-pressed={favourites.includes(template.id)}
                    aria-label={
                      favourites.includes(template.id)
                        ? `Remove ${template.name} from your favourites`
                        : `Save ${template.name} to your favourites`
                    }
                    className="shrink-0 rounded-full p-2 text-outline transition-colors duration-300 hover:bg-surface-container hover:text-primary-container focus:outline-none focus:ring-4 focus:ring-primary-container/15"
                  >
                    <Heart
                      size={18}
                      aria-hidden
                      className={
                        favourites.includes(template.id)
                          ? "fill-primary-container text-primary-container"
                          : ""
                      }
                    />
                  </button>
                </div>

                <div className="mt-auto flex flex-col gap-3 p-5">
                  <Link
                    href={`/design?template=${template.id}&product=${productId}`}
                    className="rounded-lg bg-primary-container px-5 py-3 text-center font-body font-medium tracking-wide text-white transition-colors duration-300 hover:bg-primary"
                  >
                    Edit this design
                  </Link>
                  <Link
                    href="/#contact"
                    className="rounded-lg border-2 border-primary-container px-5 py-3 text-center font-body font-medium tracking-wide text-primary-container transition-colors duration-300 hover:bg-surface-container"
                  >
                    We design for you
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryLink({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={
        selected
          ? "rounded-lg bg-primary-container px-3.5 py-2 text-left font-body text-sm font-medium tracking-wide text-white transition-colors duration-300"
          : "rounded-lg px-3.5 py-2 text-left font-body text-sm font-medium tracking-wide text-on-surface-variant transition-colors duration-300 hover:bg-surface-container-low hover:text-primary"
      }
    >
      {label}
    </button>
  );
}
