import ProductCard from "@/components/ProductCard";
import { DesignForYouCard, UploadDesignCard } from "@/components/OtherWaysCards";
import type { ProductShowcase } from "@/lib/templates";

/**
 * The home page's "everything else" grid: every sellable product other than
 * the one the hero leads with, then the two ways to order that aren't a
 * catalogue product. Only sellable products appear (see getSellableProducts),
 * so there is never a card that leads to an empty shelf. While the lead
 * product is the only one on sale the section names no other product: it
 * shrinks to the two other ways to order (the compact cards, as on /shop).
 */
export default function ProductRange({ products }: { products: ProductShowcase[] }) {
  const hasRange = products.length > 0;

  return (
    <section id="products" className="scroll-mt-4 bg-paper">
      <div className="site-container flex flex-col gap-12 py-20 md:py-24">
        <div className="flex max-w-[640px] flex-col gap-3">
          <h2 className="type-section">
            {hasRange ? "Everything else for the day, and after" : "Other ways to order"}
          </h2>
          <p className="text-ink-2">
            {hasRange
              ? "Keepsakes to hand out at the service, and cards to thank the people who supported you."
              : "Let us put it together for you, or send us a design you already have."}
          </p>
        </div>
        <div
          className={
            hasRange
              ? "grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-6"
              : "grid gap-6 md:grid-cols-2"
          }
        >
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
          <DesignForYouCard tall={hasRange} />
          <UploadDesignCard tall={hasRange} />
        </div>
      </div>
    </section>
  );
}
