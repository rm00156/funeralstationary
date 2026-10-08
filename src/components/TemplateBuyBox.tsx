"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Truck } from "lucide-react";

import { pagesAxisLabel, type ProductFormat } from "@/lib/designEditor";
import {
  copiesText,
  defaultSelection,
  formatPence,
  getQuote,
  selectionSearchParams,
  type PricingData,
  type Selection,
} from "@/lib/orderOfServicePricing";
import { priceVatNote, type VatTreatment } from "@/lib/vat";

/** Each axis, with the narrowest its option buttons may get before wrapping. */
const axes = (format: ProductFormat): { key: keyof Selection; label: string; minWidth: string }[] => [
  // A board's page-count options are its print sizes, and its paper is its finish.
  { key: "pages", label: pagesAxisLabel(format), minWidth: "96px" },
  { key: "quantity", label: "Copies", minWidth: "72px" },
  { key: "paper", label: format.paperLabel, minWidth: "130px" },
  { key: "delivery", label: "Delivery", minWidth: "180px" },
];

/**
 * The options and live price on a design's page. Product-agnostic: it renders
 * whichever options the product's four pricing tables hold, and hides an axis
 * that offers only one choice (a single-card product has one "page count",
 * which isn't a decision to put in front of the customer).
 *
 * "Personalise this design" carries the selection to /design as query params
 * (selectionSearchParams); /design validates them against the same pricing.
 * The price shown here is a live estimate from getQuote — the basket and
 * checkout always re-price server-side.
 */
export default function TemplateBuyBox({
  productId,
  templateId,
  pricing,
  format,
  vatTreatment,
}: {
  productId: string;
  templateId: string;
  pricing: PricingData;
  format: ProductFormat;
  vatTreatment: VatTreatment;
}) {
  const [selection, setSelection] = useState<Selection>(() => defaultSelection(pricing));
  const quote = useMemo(() => getQuote(pricing, selection), [pricing, selection]);
  const maximumCopies = Math.max(...pricing.quantity.map((option) => option.value));

  const noteFor = (key: keyof Selection): string | undefined => {
    if (key === "quantity") {
      return quote.quantity.multiplier < 1
        ? `${Math.round((1 - quote.quantity.multiplier) * 100)}% off the per-copy price at this quantity`
        : undefined;
    }
    // The delivery note is shown in the summary panel instead.
    return key === "delivery" ? undefined : quote[key].note;
  };

  return (
    <div className="flex flex-col gap-7">
      {axes(format).filter(({ key }) => pricing[key].length > 1).map(({ key, label, minWidth }) => {
        const note = noteFor(key);
        // Only delivery options carry a price of their own.
        const options: { id: string; label: string; pricePence?: number }[] = pricing[key];
        return (
          <div
            key={key}
            role="group"
            aria-labelledby={`option-${key}`}
            className="flex flex-col gap-2.5"
          >
            <p id={`option-${key}`} className="text-base font-semibold">
              {label}
            </p>
            <div
              className="grid gap-2.5"
              style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}, 1fr))` }}
            >
              {options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="opt"
                  aria-pressed={selection[key] === option.id}
                  onClick={() => setSelection((current) => ({ ...current, [key]: option.id }))}
                >
                  {option.label}
                  {option.pricePence !== undefined && (
                    <span className="block text-sm font-normal text-ink-3">
                      {option.pricePence === 0 ? "Free" : formatPence(option.pricePence)}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {note && <p className="text-[15px] text-ink-3">{note}</p>}
            {key === "quantity" && (
              <p className="text-[15px] text-ink-3">
                Need more than {maximumCopies}?{" "}
                <Link href={`/contact?topic=${productId}`} className="link">
                  Ask us for a price
                </Link>
                .
              </p>
            )}
          </div>
        );
      })}

      <div className="flex flex-col gap-[18px] rounded-xl border border-line bg-surface p-6">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-base text-ink-2">
            {copiesText(quote.quantity.value)} · {quote.pages.label}
            <span className="block text-[15px] text-ink-3">
              {formatPence(quote.unitPricePence)} each
              {quote.delivery.pricePence > 0 &&
                ` + ${formatPence(quote.delivery.pricePence)} delivery`}
            </span>
          </span>
          <span className="text-right">
            <span aria-live="polite" className="block font-display text-[34px] leading-none text-ink">
              {formatPence(quote.totalPence)}
            </span>
            <span className="text-sm text-ink-3">{priceVatNote(vatTreatment)}</span>
          </span>
        </div>
        <div className="flex items-start gap-3 rounded-lg bg-mist-2 px-3.5 py-3 text-base">
          <Truck size={22} strokeWidth={1.7} aria-hidden className="mt-0.5 shrink-0 text-plum" />
          <span>
            <strong className="font-semibold">{quote.delivery.label}</strong>
            {quote.delivery.note && ` — ${quote.delivery.note}`}
          </span>
        </div>
        <Link
          href={`/design?template=${templateId}&product=${productId}&${selectionSearchParams(selection)}`}
          className="btn btn-primary min-h-[58px] text-lg"
        >
          Personalise this design
          <ArrowRight size={18} aria-hidden />
        </Link>
        <p className="text-center text-[15px] text-ink-3">
          You’ll see every page as you go. Nothing is printed until you order.
        </p>
      </div>
    </div>
  );
}
