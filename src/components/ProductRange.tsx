import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { formatPence } from "@/lib/orderOfServicePricing";
import type { ProductShowcase } from "@/lib/templates";

/**
 * The home page's product cards — the first decision a customer makes is
 * *which product* (a booklet, memorial cards, ...), so that is what the hero's
 * "Start your design" lands on. Themes are a filter inside a product, not a
 * way in: a template belongs to exactly one product, so a theme tile that
 * spans products would silently pick one. Only sellable products appear (see
 * getSellableProducts), so there is never a card that leads to an empty shelf.
 */
const GRID_COLUMNS: Record<number, string> = {
  1: "grid-cols-1 max-w-md mx-auto",
  2: "grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
};

export default function ProductRange({
  products,
}: {
  products: ProductShowcase[];
}) {
  const columns = GRID_COLUMNS[products.length] ?? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <section
      id="products"
      className="py-section-gap px-margin-mobile md:px-gutter bg-surface"
    >
      <div className="max-w-[1200px] mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-semibold text-primary mb-4">
            What would you like to create?
          </h2>
          <p className="font-body text-lg text-on-surface-variant max-w-2xl mx-auto">
            Choose a product to see its designs and prices. Personalise it
            online, and we print and deliver it anywhere in the UK.
          </p>
        </div>

        {products.length === 0 ? (
          <p className="text-center font-body text-on-surface-variant">
            Our range is being prepared &mdash; please check back soon.
          </p>
        ) : (
          <div className={`grid gap-6 md:gap-8 ${columns}`}>
            {products.map((product) => (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="group flex flex-col rounded-xl border border-outline-variant/30 bg-surface-container-lowest overflow-hidden ambient-shadow transition-transform duration-300 hover:-translate-y-1"
              >
                <div className="relative h-64 bg-surface-container-low">
                  <Image
                    src={product.image}
                    alt={`${product.label} designs`}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-contain p-6"
                  />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="font-display text-2xl text-on-surface group-hover:text-primary transition-colors">
                    {product.label}
                  </h3>
                  <p className="mt-1 font-body text-sm text-on-surface-variant">
                    {product.templateCount}{" "}
                    {product.templateCount === 1 ? "design" : "designs"} &middot; from{" "}
                    <span className="font-semibold text-secondary">
                      {formatPence(product.fromPence)}
                    </span>{" "}
                    for {product.fromCopies} copies
                  </p>
                  <span className="mt-auto pt-6 inline-flex items-center gap-2 font-body text-sm font-medium tracking-wide text-primary-container">
                    See designs and prices
                    <ArrowRight
                      size={16}
                      aria-hidden
                      className="transition-transform duration-300 group-hover:translate-x-1"
                    />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
