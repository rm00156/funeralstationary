import Image from "next/image";
import Link from "next/link";

import type { CategoryShowcase, Product } from "@/lib/templates";

/**
 * The home page's category grid. Everything here comes from the catalogue
 * (see getCategoryShowcase / getProducts) — the tiles used to be a hardcoded
 * list of themes that no longer matched any real category, so a tile could
 * advertise a theme we had no templates for. Each tile deep-links into
 * /templates with that category pre-selected. Capped at two rows of the
 * 4-column grid; the rest of the categories are reachable from /templates.
 */
const MAX_TILES = 8;

export default function ProductRange({
  categories,
  products,
}: {
  categories: CategoryShowcase[];
  products: Product[];
}) {
  return (
    <section
      id="templates"
      className="py-section-gap px-margin-mobile md:px-gutter bg-surface"
    >
      <div className="max-w-[1200px] mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-semibold text-primary mb-4">
            Our Product Range
          </h2>
          <p className="font-body text-lg text-on-surface-variant max-w-2xl mx-auto">
            Browse our collection of beautifully crafted designs to find the
            perfect tribute.
          </p>
        </div>

        {categories.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {categories.slice(0, MAX_TILES).map((category) => (
              <Link
                key={category.id}
                href={`/templates?category=${category.id}`}
                className="group block text-center"
              >
                <div className="bg-surface-container-low rounded-xl p-4 mb-4 h-64 flex items-center justify-center ambient-shadow transition-transform duration-300 group-hover:-translate-y-1 relative overflow-hidden">
                  <Image
                    src={category.image}
                    alt={`${category.label} designs`}
                    fill
                    sizes="(min-width: 768px) 25vw, 50vw"
                    className="object-contain p-2"
                  />
                </div>
                <h3 className="font-display text-xl text-on-surface group-hover:text-primary transition-colors">
                  {category.label}
                </h3>
                <p className="font-body text-sm text-on-surface-variant">
                  {category.templateCount}{" "}
                  {category.templateCount === 1 ? "design" : "designs"}
                </p>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-12 flex flex-wrap justify-center gap-4">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/templates?product=${product.id}`}
              className="px-6 py-3 bg-surface-container-highest text-on-surface-variant rounded-full text-sm font-medium tracking-wide transition-colors duration-300 hover:text-primary"
            >
              {product.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
