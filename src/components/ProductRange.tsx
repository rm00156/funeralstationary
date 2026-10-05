import ProductCard from "@/components/ProductCard";
import { DesignForYouCard, UploadDesignCard } from "@/components/OtherWaysCards";
import type { ProductShowcase } from "@/lib/templates";

/**
 * Stand-ins from the handoff for products that aren't on sale yet. Shown only
 * while no other product is sellable, so the section keeps its shape; once a
 * real product is complete in /admin it replaces them (and they all go).
 */
const COMING_SOON = [
  { label: "Bookmarks", blurb: "A keepsake to hand out at the service.", occasion: "For the service" },
  { label: "Memorial cards", blurb: "A small card to remember them by.", occasion: "For the service" },
  { label: "Thank you cards", blurb: "Thank the people who supported you.", occasion: "After the service" },
  { label: "Memorial photos", blurb: "A printed portrait to keep or share.", occasion: "After the service" },
  { label: "Pet sympathy cards", blurb: "A kind word for the loss of a pet.", occasion: "After the service" },
];

function ComingSoonCard({ label, blurb, occasion }: (typeof COMING_SOON)[number]) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex h-[220px] items-center justify-center bg-mist-2">
        <div className="cover aspect-[148/210] h-[164px] rounded-[3px] bg-sheet" aria-hidden />
      </div>
      <div className="flex flex-1 flex-col gap-2 px-7 pb-7 pt-6">
        <p className="eyebrow">{occasion}</p>
        <h3 className="font-display text-2xl font-medium text-ink">{label}</h3>
        <p className="flex-1 text-base text-ink-2">{blurb}</p>
        <p className="mt-2 text-base font-semibold text-ink-3">Coming soon</p>
      </div>
    </div>
  );
}

/**
 * The home page's "everything else" grid: every sellable product other than
 * the one the hero leads with, then the two ways to order that aren't a
 * catalogue product. Only sellable products appear (see getSellableProducts),
 * so there is never a card that leads to an empty shelf — and while the lead
 * product is the only one on sale, the planned range shows as "Coming soon"
 * placeholders (see COMING_SOON).
 */
export default function ProductRange({ products }: { products: ProductShowcase[] }) {
  const hasRange = products.length > 0;

  return (
    <section id="products" className="scroll-mt-4 bg-paper">
      <div className="site-container flex flex-col gap-12 py-20 md:py-24">
        <div className="flex max-w-[640px] flex-col gap-3">
          <h2 className="type-section">
            Everything else for the day, and after
          </h2>
          <p className="text-ink-2">
            Keepsakes to hand out at the service, and cards to thank the people who supported you.
          </p>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
          {!hasRange &&
            COMING_SOON.map((item) => <ComingSoonCard key={item.label} {...item} />)}
          <DesignForYouCard tall />
          <UploadDesignCard tall />
        </div>
      </div>
    </section>
  );
}
