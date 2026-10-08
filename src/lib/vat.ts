/**
 * How a product is taxed — set per product in /admin (products.vat_treatment)
 * and frozen onto each order line at the pay click (order_items.vat_treatment).
 *
 * Four answers, not a checkbox: standard (20%) and reduced (5%) charge VAT;
 * zero-rated and exempt charge none, but they are different answers in the
 * shop's books (Thintent posts them under different tax codes), so they are
 * kept apart even though the arithmetic is the same. Printed booklets and
 * leaflets are often zero-rated, cards and boards usually standard — which
 * one a product is, is the shop's (and its accountant's) call, not this
 * code's. New products default to standard, which is what every order
 * before this existed was charged.
 *
 * Client-safe (no DB import): the schema, the admin form and the pure order
 * maths all read it.
 */
import { formatPence } from "@/lib/orderOfServicePricing";

export const VAT_TREATMENTS = ["standard", "reduced", "zero", "exempt"] as const;
export type VatTreatment = (typeof VAT_TREATMENTS)[number];

/** The rate each treatment charges, as a fraction — fixed by law. */
export const VAT_TREATMENT_RATE: Record<VatTreatment, number> = {
  standard: 0.2,
  reduced: 0.05,
  zero: 0,
  exempt: 0,
};

export const VAT_TREATMENT_LABELS: Record<VatTreatment, string> = {
  standard: "Standard 20%",
  reduced: "Reduced 5%",
  zero: "Zero-rated",
  exempt: "Exempt",
};

/** A line frozen before treatments existed was charged the standard rate. */
export const LEGACY_VAT_TREATMENT: VatTreatment = "standard";

export function isVatTreatment(value: unknown): value is VatTreatment {
  return (VAT_TREATMENTS as readonly unknown[]).includes(value);
}

/** Does this treatment put any VAT on the price? */
export function chargesVat(treatment: VatTreatment): boolean {
  return VAT_TREATMENT_RATE[treatment] > 0;
}

/** The line under a total: "Includes VAT of £16.67", or "No VAT" when none was charged. */
export function vatIncludedText(vatPence: number): string {
  return vatPence > 0 ? `Includes VAT of ${formatPence(vatPence)}` : "No VAT";
}

/** Under a product's price: "Includes VAT", or "No VAT" for one that's zero-rated or exempt. */
export function priceVatNote(treatment: VatTreatment): string {
  return chargesVat(treatment) ? "Includes VAT" : "No VAT";
}

/**
 * How an order's VAT was charged, for the admin order page: "20%", "5%",
 * "zero-rated", "exempt", or "mixed rates". A line paid before treatments
 * existed (null) was charged the standard rate.
 */
export function vatRateLabel(treatments: readonly (VatTreatment | null)[]): string {
  const distinct = [...new Set(treatments.map((t) => t ?? LEGACY_VAT_TREATMENT))];
  if (distinct.length > 1) return "mixed rates";
  const only = distinct[0] ?? LEGACY_VAT_TREATMENT;
  return chargesVat(only) ? `${Math.round(VAT_TREATMENT_RATE[only] * 100)}%` : VAT_TREATMENT_LABELS[only].toLowerCase();
}
