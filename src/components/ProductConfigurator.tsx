"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Truck } from "lucide-react";
import ConfigField from "@/components/ConfigField";
import {
  defaultSelection,
  formatPence,
  getQuote,
  selectionSearchParams,
  type PricingData,
  type Selection,
} from "@/lib/orderOfServicePricing";

const AXES: { key: keyof Selection; label: string }[] = [
  { key: "quantity", label: "Copies" },
  { key: "pages", label: "No. of Pages" },
  { key: "paper", label: "Paper Type" },
  { key: "delivery", label: "Delivery" },
];

/**
 * The live price calculator on a product page. Product-agnostic: it renders
 * whichever options the product's four pricing tables hold, and hides an axis
 * that offers only one choice (a single-card product has one "page count",
 * which isn't a decision to put in front of the customer).
 */
export default function ProductConfigurator({
  productId,
  pricing,
}: {
  productId: string;
  pricing: PricingData;
}) {
  const [selection, setSelection] = useState<Selection>(() =>
    defaultSelection(pricing),
  );
  const quote = useMemo(() => getQuote(pricing, selection), [pricing, selection]);
  const minimumCopies = Math.min(...pricing.quantity.map((option) => option.value));

  const update = (key: keyof Selection) => (value: string) =>
    setSelection((current) => ({ ...current, [key]: value }));

  const noteFor = (key: keyof Selection): string | undefined => {
    if (key === "quantity") {
      return quote.quantity.multiplier < 1
        ? `${Math.round((1 - quote.quantity.multiplier) * 100)}% off the per-copy price at this quantity`
        : `Minimum order is ${minimumCopies} copies`;
    }
    return quote[key].note;
  };

  return (
    <div className="rounded-xl border border-soft-sage bg-surface-container-lowest p-6 md:p-8 ambient-shadow">
      <h2 className="font-display text-2xl text-primary mb-1">
        Price your order
      </h2>
      <p className="font-body text-on-surface-variant mb-8">
        Choose your options and the price updates as you go.
      </p>

      <div className="space-y-6">
        {AXES.filter(({ key }) => pricing[key].length > 1).map(({ key, label }) => (
          <ConfigField
            key={key}
            id={`${productId}-${key}`}
            label={label}
            value={selection[key]}
            options={pricing[key]}
            onChange={update(key)}
            note={noteFor(key)}
          />
        ))}
      </div>

      <div className="mt-8 rounded-xl bg-surface-container-low p-6">
        <dl className="space-y-3 font-body text-on-surface-variant">
          <div className="flex justify-between gap-4">
            <dt>
              {quote.quantity.value} copies &middot; {quote.pages.label}
              <span className="block text-sm">
                {formatPence(quote.unitPricePence)} each
              </span>
            </dt>
            <dd className="text-on-surface">{formatPence(quote.printCostPence)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>{quote.delivery.label}</dt>
            <dd className="text-on-surface">
              {quote.delivery.pricePence === 0
                ? "Free"
                : formatPence(quote.delivery.pricePence)}
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex items-baseline justify-between gap-4 border-t border-outline-variant/40 pt-5">
          <span className="font-display text-xl text-on-surface">Price</span>
          <span
            aria-live="polite"
            className="font-display text-4xl font-semibold text-primary"
          >
            {formatPence(quote.totalPence)}
          </span>
        </div>
        <p className="mt-2 text-right font-body text-sm text-on-surface-variant">
          Includes VAT
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-4">
        <Link
          href={`/templates?product=${productId}&${selectionSearchParams(selection)}`}
          className="rounded-lg bg-primary-container px-10 py-4 text-center text-lg font-medium tracking-wide text-white shadow-lg shadow-primary-container/30 transition-all duration-300 hover:bg-primary hover:scale-[1.02]"
        >
          Choose a design
        </Link>
        <Link
          href="/#contact"
          className="rounded-lg border-2 border-primary-container bg-surface/80 px-10 py-4 text-center text-lg font-medium tracking-wide text-primary-container transition-colors duration-300 hover:bg-surface-container"
        >
          Upload my own design
        </Link>
      </div>

      <p className="mt-6 flex items-start gap-3 font-body text-sm text-on-surface-variant">
        <Truck size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden />
        Order before 11am with next day delivery and your order arrives the
        next working day, anywhere in the UK.
      </p>
    </div>
  );
}
