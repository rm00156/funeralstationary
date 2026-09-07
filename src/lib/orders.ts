/**
 * Pure order-domain helpers: the status machine, VAT, order totals, strict
 * selection resolution, order numbers and Stripe line items.
 *
 * DB-free (same discipline as orderOfServicePricing.ts) so it unit-tests
 * without a database. The server seam that uses these is orders.server.ts.
 */
import { orderStatusValues } from "@/db/schema/orders";
import {
  getQuote,
  type PricingData,
  type Quote,
  type Selection,
} from "@/lib/orderOfServicePricing";

/* ------------------------------------------------------------------ */
/* Status machine                                                      */
/* ------------------------------------------------------------------ */

export type OrderStatus = (typeof orderStatusValues)[number];
export const ORDER_STATUSES = orderStatusValues;

/**
 * Which statuses an order may move to from each one. `draft` only ever
 * leaves via payment (finaliseOrder → awaiting_proof) or cancellation — it
 * is never set by hand. Admin status changes go through canTransition().
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  draft: ["cancelled"],
  awaiting_proof: ["proof_sent", "cancelled"],
  proof_sent: ["approved", "awaiting_proof", "cancelled"],
  approved: ["in_production", "proof_sent", "cancelled"],
  in_production: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: ["refunded"],
  cancelled: ["refunded"],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

export function parseOrderStatus(value: unknown): OrderStatus | null {
  return ORDER_STATUSES.includes(value as OrderStatus) ? (value as OrderStatus) : null;
}

/** Customer-facing wording. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Draft",
  awaiting_proof: "Awaiting proof",
  proof_sent: "Proof sent",
  approved: "Proof approved",
  in_production: "In production",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

/* --------------------------- proof review --------------------------- */

export const ORDER_PROOF_STATUSES = [
  "generated",
  "sent",
  "changes_requested",
  "approved",
] as const;

export type OrderProofStatus = (typeof ORDER_PROOF_STATUSES)[number];

/** The two answers a customer can give when looking at their proof. */
export type ProofDecision = "approved" | "changes_requested";

export function parseProofDecision(value: unknown): ProofDecision | null {
  return value === "approved" || value === "changes_requested" ? value : null;
}

interface ProofLike {
  version: number;
  status: OrderProofStatus;
}

/**
 * The proof version the customer is currently looking at: the highest one
 * that has actually been sent to them.
 *
 * A `generated` proof is the admin's working copy — it exists the moment
 * the render finishes, before anyone has decided it is fit to show — so it
 * must never reach the customer. Anything from `sent` onwards has been,
 * including versions they have already responded to.
 */
export function latestVisibleProof<T extends ProofLike>(proofs: readonly T[]): T | null {
  let best: T | null = null;
  for (const proof of proofs) {
    if (proof.status === "generated") continue;
    if (!best || proof.version > best.version) best = proof;
  }
  return best;
}

/** Only a proof still awaiting an answer can be answered. */
export function canReviewProof(status: OrderProofStatus): boolean {
  return status === "sent";
}

/**
 * Whether the order as a whole is approved: every line's current proof
 * approved, and every line actually has one. A two-item order is not
 * approved because the customer signed off one of them.
 */
export function allProofsApproved(
  items: readonly { proofs: readonly ProofLike[] }[],
): boolean {
  if (items.length === 0) return false;
  return items.every((item) => latestVisibleProof(item.proofs)?.status === "approved");
}

/* ------------------------------------------------------------------ */
/* Money                                                               */
/* ------------------------------------------------------------------ */

/** Prices are VAT-inclusive; this is the rate backed out of them. */
export const DEFAULT_VAT_RATE = 0.2;

/** 0.2 -> "0.2000", the decimal(5,4) string orders.vat_rate stores. */
export function vatRateToDecimalString(rate: number): string {
  return rate.toFixed(4);
}

/** The VAT contained within a VAT-inclusive amount, in integer pence. */
export function vatFromInclusive(grossPence: number, rate: number = DEFAULT_VAT_RATE): number {
  return grossPence - Math.round(grossPence / (1 + rate));
}

export interface OrderTotals {
  subtotalPence: number;
  deliveryPence: number;
  totalPence: number;
  vatPence: number;
  vatRate: number;
}

/** subtotal = Σ line totals; total = subtotal + delivery; VAT backed out of total. */
export function computeOrderTotals(
  lineTotalsPence: number[],
  deliveryPence: number,
  vatRate: number = DEFAULT_VAT_RATE,
): OrderTotals {
  const subtotalPence = lineTotalsPence.reduce((sum, pence) => sum + pence, 0);
  const totalPence = subtotalPence + deliveryPence;
  return {
    subtotalPence,
    deliveryPence,
    totalPence,
    vatPence: vatFromInclusive(totalPence, vatRate),
    vatRate,
  };
}

/* ------------------------------------------------------------------ */
/* Selection                                                           */
/* ------------------------------------------------------------------ */

export type SelectionAxis = keyof Selection;

export const SELECTION_AXES: readonly SelectionAxis[] = [
  "quantity",
  "size",
  "colour",
  "pages",
  "paper",
  "delivery",
];

/**
 * getQuote() silently falls back to the first option for an unknown id —
 * fine for a live configurator, dangerous for pricing slugs that came from
 * the client or were stored before an option was deactivated. This is the
 * strict form: every slug must exist in the (active) PricingData, or the
 * offending axes are reported and nothing is priced.
 */
export function resolveSelectionStrict(
  data: PricingData,
  selection: Selection,
): { ok: true; quote: Quote } | { ok: false; invalid: SelectionAxis[] } {
  const invalid = SELECTION_AXES.filter(
    (axis) => !data[axis].some((option) => option.id === selection[axis]),
  );
  if (invalid.length > 0) return { ok: false, invalid };
  return { ok: true, quote: getQuote(data, selection) };
}

/* ------------------------------------------------------------------ */
/* Order numbers                                                       */
/* ------------------------------------------------------------------ */

export const ORDER_NUMBER_RE = /^TFS-\d{4}-\d{6}$/;

/**
 * TFS-<year>-<6 random digits>. Random rather than sequential: no counter
 * table, no order-volume leak, and abandoned carts burning numbers is
 * harmless. Callers retry on a duplicate-key collision.
 */
export function makeOrderNumber(year: number, random: () => number = Math.random): string {
  const digits = Math.floor(random() * 1_000_000)
    .toString()
    .padStart(6, "0");
  return `TFS-${year}-${digits}`;
}

/* ------------------------------------------------------------------ */
/* Stripe                                                              */
/* ------------------------------------------------------------------ */

export interface StripeLineItem {
  name: string;
  unitAmountPence: number;
  quantity: number;
}

/**
 * One Stripe line per order line (unit price x copies, so Stripe's sum is
 * exactly our subtotal) plus a delivery line when it costs anything.
 * SDK-agnostic so it can be tested; stripe.server.ts maps it to price_data.
 */
export function buildStripeLineItems(
  items: ReadonlyArray<{ name: string; unitPricePence: number; copies: number }>,
  delivery: { label: string; pricePence: number } | null,
): StripeLineItem[] {
  const lines: StripeLineItem[] = items.map((item) => ({
    name: item.name,
    unitAmountPence: item.unitPricePence,
    quantity: item.copies,
  }));
  if (delivery && delivery.pricePence > 0) {
    lines.push({
      name: `Delivery — ${delivery.label}`,
      unitAmountPence: delivery.pricePence,
      quantity: 1,
    });
  }
  return lines;
}

export function sumLineItems(lines: ReadonlyArray<StripeLineItem>): number {
  return lines.reduce((sum, line) => sum + line.unitAmountPence * line.quantity, 0);
}
