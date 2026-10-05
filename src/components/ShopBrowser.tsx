"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { DesignForYouCard, UploadDesignCard } from "@/components/OtherWaysCards";
import ProductCard from "@/components/ProductCard";
import { formatPence } from "@/lib/orderOfServicePricing";
import {
  OCCASION_LABELS,
  PRODUCT_OCCASIONS,
  type ProductOccasion,
  type ProductShowcase,
} from "@/lib/templates";

type Filter = "all" | ProductOccasion | "other";

/**
 * The shop page's range: filter chips, the first product as a full-width
 * feature, then every other sellable product and the two "other ways to
 * order". The chips filter in the browser — the whole range is a handful of
 * cards — and a group with nothing in it gets no chip.
 */
export default function ShopBrowser({ products }: { products: ProductShowcase[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const occasions = PRODUCT_OCCASIONS.filter((occasion) =>
    products.some((product) => product.occasion === occasion),
  );
  const chips: { id: Filter; label: string }[] = [
    { id: "all", label: "Everything" },
    ...occasions.map((occasion) => ({ id: occasion, label: OCCASION_LABELS[occasion] })),
    { id: "other", label: "Other ways to order" },
  ];

  const visible = products.filter((product) => filter === "all" || product.occasion === filter);
  // The first product on the shelf leads; the rest fill the grid.
  const [featured, ...rest] = visible;
  const showOther = filter === "all" || filter === "other";

  return (
    <>
      <div className="site-container pb-10">
        <div role="group" aria-label="Filter products" className="flex flex-wrap gap-2.5">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className="chip"
              aria-pressed={filter === chip.id}
              onClick={() => setFilter(chip.id)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {featured && (
        <div className="site-container pb-8">
          <Link
            href={`/products/${featured.id}`}
            className="card-link grid grid-cols-[repeat(auto-fit,minmax(min(420px,100%),1fr))] overflow-hidden rounded-2xl border border-line bg-surface no-underline"
          >
            <div className="flex min-h-[320px] items-center justify-center bg-mist-3 px-6 py-10">
              <div className="cover relative aspect-[148/210] w-[190px] rotate-[-4deg] overflow-hidden rounded-[3px] bg-sheet">
                <Image
                  src={featured.image}
                  alt={`${featured.label} design`}
                  fill
                  priority
                  sizes="190px"
                  className="object-cover"
                />
              </div>
            </div>
            <div className="flex flex-col justify-center gap-4 p-8 sm:p-12">
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-plum">
                {OCCASION_LABELS[featured.occasion]}
              </p>
              <h2 className="font-display text-[40px] font-normal leading-[1.1] text-ink text-balance">
                {featured.label}
              </h2>
              <p className="text-ink-2">
                {featured.templateCount} {featured.templateCount === 1 ? "design" : "designs"}
                {featured.description ? `. ${featured.description}` : " to personalise online."}
              </p>
              <p className="text-[17px] text-ink">
                <strong className="font-semibold">From {formatPence(featured.fromPence)}</strong>{" "}
                <span className="text-ink-3">for {featured.fromCopies} copies</span>
              </p>
              <span className="btn btn-primary mt-2 self-start text-[17px]">
                Browse {featured.templateCount}{" "}
                {featured.templateCount === 1 ? "design" : "designs"}
                <ArrowRight size={18} aria-hidden />
              </span>
            </div>
          </Link>
        </div>
      )}

      <div className="site-container grid grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] gap-6 pb-24">
        {rest.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
        {showOther && <DesignForYouCard tall={rest.length > 0} />}
        {showOther && <UploadDesignCard tall={rest.length > 0} />}
      </div>
    </>
  );
}
