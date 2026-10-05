import Link from "next/link";
import { ArrowRight } from "lucide-react";

import TemplateCard from "@/components/TemplateCard";
import { copiesText, formatPence } from "@/lib/orderOfServicePricing";
import type { ProductShowcase, Template } from "@/lib/templates";

/**
 * "Choose a design to begin" — the first few designs of the shop's lead
 * product, which is where the hero's "Browse designs" lands. Every design in
 * a product costs the same, so each card carries the product's "from" price.
 */
export default function HomeDesigns({
  product,
  templates,
}: {
  product: ProductShowcase;
  templates: Template[];
}) {
  const productHref = `/products/${product.id}`;
  const from = `From ${formatPence(product.fromPence)} · ${copiesText(product.fromCopies)}`;

  return (
    <section id="designs" className="scroll-mt-4 border-y border-line bg-surface">
      <div className="site-container flex flex-col gap-12 py-20 md:py-24">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="flex max-w-[640px] flex-col gap-3">
            <h2 className="type-section">Choose a design to begin</h2>
            <p className="text-ink-2">
              Every design is personalised online with your own photographs and words. Prices
              start at {formatPence(product.fromPence)} for {copiesText(product.fromCopies)} – check
              yours with our{" "}
              <Link href={`${productHref}#prices`} className="link">
                price calculator
              </Link>
              .
            </p>
          </div>
          <Link href={productHref} className="link flex min-h-11 items-center gap-2 font-medium">
            See all {product.templateCount} designs <ArrowRight size={18} aria-hidden />
          </Link>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-8">
          {templates.map((template) => (
            <TemplateCard
              trim={product.format.trim}
              key={template.id}
              href={`${productHref}/${template.id}`}
              name={template.name}
              image={template.image}
              meta={from}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
