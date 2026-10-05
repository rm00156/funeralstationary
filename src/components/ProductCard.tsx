import Image from "next/image";
import Link from "next/link";

import { formatPence } from "@/lib/orderOfServicePricing";
import { OCCASION_LABELS, type ProductShowcase } from "@/lib/templates";

/**
 * A product in the shop grid: its first design on a tinted panel, the
 * occasion it is for, name, blurb and the "from" price. One link, to the
 * product's page. `compact` is the small horizontal card under "You may also
 * need".
 */
export default function ProductCard({
  product,
  compact = false,
}: {
  product: ProductShowcase;
  compact?: boolean;
}) {
  const href = `/products/${product.id}`;

  if (compact) {
    return (
      <Link
        href={href}
        className="card-link group flex items-center gap-5 rounded-xl border border-line bg-surface p-5 no-underline"
      >
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-mist-2">
          <div className="cover relative aspect-[148/210] h-[74px] overflow-hidden rounded-[3px] bg-sheet">
            <Image src={product.image} alt="" fill sizes="52px" className="object-cover" />
          </div>
        </div>
        <div>
          <h3 className="font-display text-[21px] font-medium text-ink underline-offset-4 group-hover:underline">
            {product.label}
          </h3>
          <p className="text-[15px] text-ink-3">
            From {formatPence(product.fromPence)} for {product.fromCopies}
          </p>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="card-link group flex flex-col overflow-hidden rounded-xl border border-line bg-surface no-underline"
    >
      <div className="flex h-[220px] items-center justify-center bg-mist-2">
        <div className="cover relative aspect-[148/210] h-[164px] overflow-hidden rounded-[3px] bg-sheet">
          <Image
            src={product.image}
            alt={`${product.label} design`}
            fill
            sizes="116px"
            className="object-cover"
          />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-7 pb-7 pt-6">
        <p className="eyebrow">{OCCASION_LABELS[product.occasion]}</p>
        <h3 className="font-display text-2xl font-medium text-ink underline-offset-4 group-hover:underline">
          {product.label}
        </h3>
        {product.description && (
          <p className="flex-1 text-base text-ink-2">{product.description}</p>
        )}
        <p className="mt-2 text-base text-ink">
          <strong className="font-semibold">From {formatPence(product.fromPence)}</strong>{" "}
          <span className="text-ink-3">for {product.fromCopies} copies</span>
        </p>
      </div>
    </Link>
  );
}
