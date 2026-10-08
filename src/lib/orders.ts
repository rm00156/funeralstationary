/**
 * Pure order-domain helpers: the status machine, VAT, order totals, strict
 * selection resolution, order numbers and Stripe line items.
 *
 * DB-free (same discipline as orderOfServicePricing.ts) so it unit-tests
 * without a database. The server seam that uses these is orders.server.ts.
 */
import { orderStatusValues } from "@/db/schema/orders";
import type { ProductFormat } from "@/lib/designEditor";
import {
  getQuote,
  type PricingData,
  type Quote,
  type Selection,
} from "@/lib/orderOfServicePricing";
import { LEGACY_VAT_TREATMENT, VAT_TREATMENT_RATE, type VatTreatment } from "@/lib/vat";

/* ------------------------------------------------------------------ */
/* Status machine                                                      */
/* ------------------------------------------------------------------ */

export type OrderStatus = (typeof orderStatusValues)[number];
export const ORDER_STATUSES = orderStatusValues;

/**
 * Which statuses an order may move to from each one. `draft` only ever
 * leaves via payment (finaliseOrder → awaiting_print) or cancellation — it
 * is never set by hand. Admin status changes go through canTransition().
 *
 * There is no proof-approval detour: the design was checked before it could
 * be paid for (see src/lib/designReadiness.ts), so a paid order is simply
 * waiting to reach the press.
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  draft: ["cancelled"],
  awaiting_print: ["in_production", "cancelled"],
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

/** The earliest funeral date among an order's lines — what its print run is planned by. */
export function earliestServiceDate(dates: readonly (string | null)[]): string | null {
  return dates.filter((date): date is string => !!date).sort()[0] ?? null;
}

/** Customer-facing wording. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Draft",
  awaiting_print: "Awaiting print",
  in_production: "In production",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

/* ------------------------------------------------------------------ */
/* Refunds                                                             */
/* ------------------------------------------------------------------ */

/** A refund as Stripe reports it (order_refunds mirrors these). */
export interface OrderRefund {
  stripeRefundId: string;
  amountPence: number;
  /** Stripe's: pending / succeeded / failed / canceled / requires_action. */
  status: string;
  refundedAt: Date;
}

/** What has actually gone back to the customer — succeeded refunds only. */
export function refundedPence(refunds: readonly Pick<OrderRefund, "amountPence" | "status">[]): number {
  return refunds.reduce((sum, refund) => (refund.status === "succeeded" ? sum + refund.amountPence : sum), 0);
}

/**
 * What a refund total means for the order's status:
 * - `refund`: fully refunded and the status machine allows it (cancelled or
 *   delivered) — move it to refunded;
 * - `still-printing`: fully refunded but the job is still going ahead
 *   (awaiting print / in production) — status changes in Thintent, so staff
 *   are told to cancel it there rather than this silently stopping it here;
 * - `none`: part-refunded, nothing refunded, or already settled.
 *
 * A shipped order is left alone: it reaches `refunded` once delivered.
 */
export function refundStatusEffect(
  status: OrderStatus,
  refunded: number,
  totalPence: number,
): "refund" | "still-printing" | "none" {
  if (totalPence <= 0 || refunded < totalPence) return "none";
  if (canTransition(status, "refunded")) return "refund";
  if (status === "awaiting_print" || status === "in_production") return "still-printing";
  return "none";
}

/* ------------------------------------------------------------------ */
/* Money                                                               */
/* ------------------------------------------------------------------ */

/** The standard rate — what every line was charged before products had a VAT treatment. */
export const DEFAULT_VAT_RATE = VAT_TREATMENT_RATE.standard;

/** 0.2 -> "0.2000", the decimal(5,4) string orders.vat_rate stores. */
export function vatRateToDecimalString(rate: number): string {
  return rate.toFixed(4);
}

/** The VAT contained within a VAT-inclusive amount, in integer pence. */
export function vatFromInclusive(grossPence: number, rate: number = DEFAULT_VAT_RATE): number {
  return grossPence - Math.round(grossPence / (1 + rate));
}

/** One line's money as the totals see it: print cost and its own delivery, both VAT-inclusive. */
export interface OrderLineMoney {
  printPence: number;
  deliveryPence: number;
  /** The product's treatment; its delivery is taxed the same way (it's part of the same supply). */
  vatTreatment: VatTreatment;
}

export interface OrderTotals {
  subtotalPence: number;
  deliveryPence: number;
  totalPence: number;
  vatPence: number;
  /**
   * orders.vat_rate: the one rate when every line shares a treatment, else
   * the blended figure VAT ÷ net. A record, not an input — nothing prices
   * from it.
   */
  vatRate: number;
}

/**
 * The VAT-inclusive pence charged at each treatment — every line's print
 * cost and delivery added up by the line's treatment. VAT is backed out of
 * each of these sums once (vatOfGroups), so a basket of ten 20% lines rounds
 * once, as it always did.
 */
export function grossByTreatment(lines: readonly OrderLineMoney[]): Map<VatTreatment, number> {
  const groups = new Map<VatTreatment, number>();
  for (const line of lines) {
    groups.set(line.vatTreatment, (groups.get(line.vatTreatment) ?? 0) + line.printPence + line.deliveryPence);
  }
  return groups;
}

function vatOfGroups(groups: Map<VatTreatment, number>): number {
  let vat = 0;
  for (const [treatment, gross] of groups) vat += vatFromInclusive(gross, VAT_TREATMENT_RATE[treatment]);
  return vat;
}

/**
 * subtotal = Σ print costs; delivery = Σ line deliveries (each product ships
 * on its own options); total = subtotal + delivery; VAT backed out of what
 * was charged at each treatment (grossByTreatment).
 */
export function computeOrderTotals(lines: readonly OrderLineMoney[]): OrderTotals {
  const subtotalPence = lines.reduce((sum, line) => sum + line.printPence, 0);
  const deliveryPence = lines.reduce((sum, line) => sum + line.deliveryPence, 0);
  const totalPence = subtotalPence + deliveryPence;
  const groups = grossByTreatment(lines);
  const vatPence = vatOfGroups(groups);
  const treatments = [...groups.keys()];
  const vatRate =
    treatments.length <= 1
      ? VAT_TREATMENT_RATE[treatments[0] ?? LEGACY_VAT_TREATMENT]
      : Number(((totalPence - vatPence) > 0 ? vatPence / (totalPence - vatPence) : 0).toFixed(4));
  return { subtotalPence, deliveryPence, totalPence, vatPence, vatRate };
}

/* ------------------------------------------------------------------ */
/* Selection                                                           */
/* ------------------------------------------------------------------ */

export type SelectionAxis = keyof Selection;

export const SELECTION_AXES: readonly SelectionAxis[] = [
  "quantity",
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
 * exactly our subtotal), each followed by its own delivery line when that
 * costs anything — delivery is per line, so the customer sees on the Stripe
 * page which item each charge belongs to. SDK-agnostic so it can be tested;
 * stripe.server.ts maps it to price_data.
 */
export function buildStripeLineItems(
  items: ReadonlyArray<{
    name: string;
    unitPricePence: number;
    copies: number;
    delivery: { label: string; pricePence: number };
  }>,
): StripeLineItem[] {
  return items.flatMap((item) => {
    const lines: StripeLineItem[] = [
      { name: item.name, unitAmountPence: item.unitPricePence, quantity: item.copies },
    ];
    if (item.delivery.pricePence > 0) {
      lines.push({
        name: `Delivery — ${item.delivery.label} (${item.name})`,
        unitAmountPence: item.delivery.pricePence,
        quantity: 1,
      });
    }
    return lines;
  });
}

export function sumLineItems(lines: ReadonlyArray<StripeLineItem>): number {
  return lines.reduce((sum, line) => sum + line.unitAmountPence * line.quantity, 0);
}

/**
 * A line's printed spec, as the basket, the order pages and the emails show
 * it: "A5 · 8 page · Silk", "A6 · Printed both sides · Silk card". The size
 * leads unless it is itself what the customer chose — a board sold in several
 * sizes, whose page-count option *is* the size ("A1 · Mounted on 5mm board").
 */
export function lineSpec(
  format: Pick<ProductFormat, "sizeLabel" | "sizedByOption">,
  quote: { pages: { label: string }; paper: { label: string } },
): string {
  return [
    ...(format.sizedByOption ? [] : [format.sizeLabel]),
    quote.pages.label,
    quote.paper.label,
  ].join(" · ");
}

/**
 * The spec line for a basket line that no longer prices (no quote): the size
 * and its page count, or for a sized-by-option product just its size range —
 * its "pages" option is a print size, and the one chosen is what went stale.
 */
export function staleLineSpec(
  format: Pick<ProductFormat, "sizeLabel" | "sizedByOption">,
  pageCount: number,
): string {
  if (format.sizedByOption) return format.sizeLabel;
  return `${format.sizeLabel} · ${pageCount} ${pageCount === 1 ? "page" : "pages"}`;
}
