/**
 * Thintent sync, pure half: the order payload sent to the shop's Thintent
 * account, the mapping of Thintent job statuses back onto this site's order
 * statuses, and the webhook signature check.
 *
 * DB-free (same discipline as orders.ts) so it unit-tests without a
 * database; the seam that sends and receives is thintent.server.ts.
 *
 * Thintent is the shop's working view — the job board they print from — and
 * where status is changed. This database stays the record of what was paid
 * for. Statuses flow back forward, plus a cancel (and the reopening of a job
 * Thintent itself cancelled). A cancel never moves money: the refund is made
 * in Stripe by a person.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

import { copiesText } from "@/lib/orderOfServicePricing";
import {
  ORDER_STATUS_TRANSITIONS,
  canTransition,
  lineSpec,
  pressScaleNote,
  type OrderRefund,
  type OrderStatus,
} from "@/lib/orders";
import type { OrderDetail, OrderDetailItem } from "@/lib/orders.server";
import { sameTrim } from "@/lib/designEditor";
import { tradeDiscountText } from "@/lib/trade";
import { VAT_TREATMENT_LABELS, type VatTreatment } from "@/lib/vat";

/* ------------------------------------------------------------------ */
/* Outbound: the order                                                 */
/* ------------------------------------------------------------------ */

/** Thintent's v1 website-order contract. All money is VAT-inclusive pence. */
export interface ThintentOrderPayload {
  externalRef: string;
  test: boolean;
  placedAt: string;
  /** When it was paid — absent on an order placed on account, which isn't. */
  paidAt?: string;
  currency: "GBP";
  customer: { name: string; email: string; phone: string | null };
  delivery: {
    line1: string;
    line2: string | null;
    city: string;
    postcode: string;
    country: string;
    label: string;
    pricePence: number;
    /** How the delivery charge is taxed. Null on an order paid before treatments existed. */
    vatTreatment: VatTreatment | null;
  } | null;
  lines: ThintentOrderLine[];
  totals: { subtotalPence: number; deliveryPence: number; vatPence: number; totalPence: number };
  /** A card order's payment. Exactly one of `payment` and `account` is sent. */
  payment?: {
    amountPence: number;
    reference: string;
    paidAt: string;
    /**
     * Stripe's fee on the payment, in pence — what the payout falls short of
     * the order total by. Null when it isn't known: no Stripe payment, one
     * not settled yet, or Stripe couldn't be asked (see paymentFeePence).
     */
    feePence: number | null;
  };
  /**
   * An order placed on account by a trade firm: Thintent bills `company` on
   * net `creditDays` terms and emails the invoice to `accountsEmail` (or the
   * customer's email), unpaid.
   */
  account?: { creditDays: number; company: string; accountsEmail?: string };
  links: { order: string };
}

export interface ThintentOrderLine {
  externalRef: string;
  title: string;
  quantity: number;
  spec: { label: string; value: string }[];
  /**
   * What was sold, for the shop to cost it: a code Thintent links once to a
   * costing, and the name it's shown by there. Null on a delivery line.
   */
  product: { code: string; name: string } | null;
  lineTotalPence: number;
  /** The product's treatment, frozen at the pay click. Null on a line paid before treatments existed. */
  vatTreatment: VatTreatment | null;
  files: { label: string; url: string }[];
  notes: string | null;
  dueDate: string | null;
}

/**
 * Thintent's column limits (its orderImportSchema). Anything longer gets the
 * whole order refused with a 422, so free text from the customer — a file
 * name, a phone number — is trimmed to fit rather than risk that.
 */
const LIMITS = { productCode: 200, title: 300, specValue: 300, fileLabel: 120, name: 200, phone: 32, postcode: 16, deliveryLabel: 120 };

const clip = (value: string, max: number): string =>
  value.length <= max ? value : `${value.slice(0, max - 1)}…`;

/**
 * Where the press file for each line is, as links rather than copies: the
 * customer's PDF for an upload, the Canva link for a Canva line, and for an
 * editor design one stable "Print PDF" link (pressFileUrl) that renders the
 * PDF the first time someone opens it. The page images aren't sent — they're
 * what the customer approved, not what goes on the press. A design with no
 * proof yet (proofs failed at payment) links the order page, where one is made.
 */
function lineFiles(item: OrderDetailItem, adminOrderUrl: string, pressUrl: string): ThintentOrderLine["files"] {
  if (item.artwork) {
    if (item.artwork.source === "pdf" && item.artwork.url) {
      return [
        { label: clip(`Customer's PDF — ${item.artwork.fileName ?? "artwork.pdf"}`, LIMITS.fileLabel), url: item.artwork.url },
      ];
    }
    return item.artwork.canvaUrl ? [{ label: "Canva design (not checked yet)", url: item.artwork.canvaUrl }] : [];
  }
  return item.proofs.length > 0
    ? [{ label: "Print PDF", url: pressUrl }]
    : [{ label: "No proof yet — make one on the website's order page", url: adminOrderUrl }];
}

/**
 * The press link's signature: HMAC-SHA256 of the order and line, keyed off
 * the Thintent API key — the secret this site already shares with Thintent,
 * and the one in hand whenever a link is minted (only when sending a job).
 * No expiry: the link lives on the job for as long as the job does. It only
 * ever opens that one line's print PDF, which is itself a public object URL.
 * Rotating the API key retires every link sent before it.
 */
export function pressFileSignature(orderId: string, itemId: string, key: string): string {
  return createHmac("sha256", key).update(`press:${orderId}:${itemId}`).digest("hex");
}

export function verifyPressFileSignature(
  orderId: string,
  itemId: string,
  signature: string | null,
  key: string,
): boolean {
  if (!signature || !key || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  return timingSafeEqual(
    Buffer.from(pressFileSignature(orderId, itemId, key), "hex"),
    Buffer.from(signature, "hex"),
  );
}

/** GET /api/thintent/press/:orderId/:itemId — the newest proof's print PDF, rendered on first open. */
export function pressFileUrl(siteOrigin: string, orderId: string, itemId: string, key: string): string {
  const sig = pressFileSignature(orderId, itemId, key);
  return `${siteOrigin}/api/thintent/press/${encodeURIComponent(orderId)}/${encodeURIComponent(itemId)}?sig=${sig}`;
}

/** What staff need to know before this line goes to press. */
function lineNotes(item: OrderDetailItem): string | null {
  const notes: string[] = [];
  if (item.artwork?.source === "canva") {
    notes.push("Canva link, not checked yet: download it as PDF Print with bleed and check the size, pages, photos and fonts.");
  }
  const accepted = item.artwork?.checks.filter((check) => check.status !== "pass") ?? [];
  if (accepted.length) {
    notes.push(
      `Customer chose to print it as it is: ${accepted.map((check) => `${check.title}. ${check.detail}`).join(" ")}`,
    );
  }
  const scale = pressScaleNote(item.format, item.artworkTrim, item.quote);
  if (scale) notes.push(`${scale}.`);
  return notes.length ? notes.join("\n") : null;
}

/**
 * The lines' delivery charges, grouped by the VAT treatment of the line each
 * belongs to (delivery is part of the supply it delivers, so it's taxed the
 * same way). Thintent has room for one delivery charge at one treatment: the
 * largest group is that, and each other group goes over as a line of its
 * own — "Delivery — Next day (zero-rated items)" — at its own treatment, so
 * every penny keeps the VAT it was charged. Usually there is only one group
 * and nothing moves. With no delivery address there is no delivery to put a
 * charge on, so every group goes as a line.
 */
export function splitDeliveryCharges(
  items: readonly Pick<OrderDetailItem, "delivery" | "vatTreatment">[],
  hasAddress: boolean,
): {
  delivery: { pricePence: number; vatTreatment: VatTreatment | null; label: string };
  asLines: ThintentOrderLine[];
} {
  const groups = new Map<VatTreatment | null, { pence: number; labels: string[] }>();
  const freeLabels: string[] = [];
  for (const item of items) {
    if (item.delivery.pricePence <= 0) {
      if (!freeLabels.includes(item.delivery.label)) freeLabels.push(item.delivery.label);
      continue;
    }
    const group = groups.get(item.vatTreatment) ?? { pence: 0, labels: [] };
    group.pence += item.delivery.pricePence;
    if (!group.labels.includes(item.delivery.label)) group.labels.push(item.delivery.label);
    groups.set(item.vatTreatment, group);
  }
  // Largest first; Map order (first line's group first) settles a tie.
  const ranked = [...groups.entries()].sort(([, a], [, b]) => b.pence - a.pence);
  const kept = hasAddress ? ranked[0] : undefined;
  const asLines = ranked
    .filter((entry) => entry !== kept)
    .map(([vatTreatment, group]): ThintentOrderLine => ({
      externalRef: `delivery-${vatTreatment ?? "legacy"}`,
      title: clip(
        `Delivery — ${group.labels.join(" + ")}${vatTreatment ? ` (${VAT_TREATMENT_LABELS[vatTreatment].toLowerCase()} items)` : ""}`,
        LIMITS.title,
      ),
      quantity: 1,
      spec: [],
      product: null,
      lineTotalPence: group.pence,
      vatTreatment,
      files: [],
      notes: null,
      dueDate: null,
    }));
  // The charge's name covers what it charges for, plus the free options
  // (which have no line of their own) — not the groups moved to lines.
  const keptLabels = kept ? kept[1].labels : [];
  const label = [...new Set([...keptLabels, ...freeLabels])].join(" + ") || "Delivery";
  return {
    delivery: kept
      ? { pricePence: kept[1].pence, vatTreatment: kept[0], label }
      : { pricePence: 0, vatTreatment: items[0]?.vatTreatment ?? null, label },
    asLines,
  };
}

/**
 * The product a line sold, as Thintent costs it. The code is the product and
 * the options it was printed at — a print size other than the product's own
 * trim, page count (or, for a sized-by-option product, the size) then paper —
 * "order-of-service/8/silk", "order-of-service/a4/8/silk": the things that
 * change what a copy costs to make. Copies aren't in it; they're the line's
 * quantity. Slugs, read off the quote frozen at the pay click, and never
 * renamed (adminCatalogue.server.ts), so a code the shop has linked keeps
 * matching. Real slugs are a few characters each; the clip only guards
 * Thintent's 200 against four maximal ones.
 */
export function lineProduct(
  item: Pick<OrderDetailItem, "productId" | "format" | "quote">,
  productLabel: string,
): { code: string; name: string } {
  return {
    code: [
      item.productId,
      // Only a size other than the product's trim, so an A5 booklet keeps the
      // code it had before sizes existed. The product's trim, not the
      // artwork's: an uploaded A4 file is drawn at A4, but it's still the A4
      // booklet, not the A5 one.
      ...(item.quote.size && !sameTrim(item.quote.size, item.format.trim) ? [item.quote.size.id] : []),
      item.quote.pages.id,
      item.quote.paper.id,
    ]
      .join("/")
      .slice(0, LIMITS.productCode),
    name: clip(`${productLabel} · ${lineSpec(item.format, item.quote)}`, LIMITS.title),
  };
}

/**
 * The order as Thintent's website-order API takes it. Built from the
 * snapshot read (loadOrderDetail), so it describes exactly what was paid
 * for — the format, quote and delivery each line was frozen with.
 *
 * Throws for an unpaid order: only a paid order becomes a job.
 */
export function buildThintentOrderPayload(
  order: OrderDetail,
  options: {
    siteOrigin: string;
    productLabels: ReadonlyMap<string, string>;
    test: boolean;
    /** Signs the press links (pressFileUrl) — the Thintent API key. */
    pressKey: string;
    /** Stripe's fee on the payment (paymentFeePence); null when unknown. */
    feePence: number | null;
  },
): ThintentOrderPayload {
  if (!order.placedAt) throw new Error(`Order ${order.orderNumber} has not been placed`);
  // A card order goes when paid; an account order is placed unpaid, on terms.
  const account = order.paymentMethod === "account" ? order.account : null;
  if (order.paymentMethod === "account" && !account) {
    throw new Error(`Order ${order.orderNumber} is on account but has no terms`);
  }
  if (!account && !order.paidAt) throw new Error(`Order ${order.orderNumber} has not been paid`);
  if (!order.contact.email) throw new Error(`Order ${order.orderNumber} has no contact email`);
  const adminOrderUrl = `${options.siteOrigin}/admin/orders/${order.id}`;
  const paidAt = order.paidAt?.toISOString();

  const lines = order.items.map((item): ThintentOrderLine => {
    const product = options.productLabels.get(item.productId) ?? item.productId;
    const artwork = !item.artwork
      ? "Designed on the website"
      : item.artwork.source === "pdf"
        ? "Customer's own PDF"
        : "Customer's Canva design";
    return {
      externalRef: item.id,
      // An upload line's name already leads with its product.
      title: clip(item.artwork ? item.designName : `${product} — ${item.designName}`, LIMITS.title),
      quantity: item.quantityCopies,
      spec: [
        { label: "Product", value: product },
        { label: "Spec", value: lineSpec(item.format, item.quote) },
        { label: "Copies", value: copiesText(item.quantityCopies) },
        { label: "Artwork", value: artwork },
        { label: "Delivery", value: item.delivery.label },
        ...(order.tradeDiscountPercent
          ? [{ label: "Price", value: `Trade price, ${tradeDiscountText(order.tradeDiscountPercent)}` }]
          : []),
        ...(item.serviceDate ? [{ label: "Service date", value: item.serviceDate }] : []),
      ].map((row) => ({ ...row, value: clip(row.value, LIMITS.specValue) })),
      product: lineProduct(item, product),
      lineTotalPence: item.lineTotalPence,
      vatTreatment: item.vatTreatment,
      files: lineFiles(item, adminOrderUrl, pressFileUrl(options.siteOrigin, order.id, item.id, options.pressKey)),
      notes: lineNotes(item),
      // The funeral date is the deadline that matters.
      dueDate: item.serviceDate,
    };
  });

  // Thintent takes one delivery charge per order, at one VAT treatment; here
  // each line chose its own delivery (options are product-scoped) and it is
  // taxed as its product is. See splitDeliveryCharges.
  const { address } = order;
  const hasAddress = !!(address.line1 && address.city && address.postcode);
  const charges = splitDeliveryCharges(order.items, hasAddress);
  lines.push(...charges.asLines);
  const delivery = hasAddress
    ? {
        line1: address.line1!,
        line2: address.line2,
        city: address.city!,
        postcode: clip(address.postcode!, LIMITS.postcode),
        country: address.country,
        label: clip(charges.delivery.label, LIMITS.deliveryLabel),
        pricePence: charges.delivery.pricePence,
        vatTreatment: charges.delivery.vatTreatment,
      }
    : null;
  const movedPence = charges.asLines.reduce((sum, line) => sum + line.lineTotalPence, 0);

  return {
    externalRef: order.orderNumber,
    test: options.test,
    placedAt: order.placedAt.toISOString(),
    ...(paidAt && !account ? { paidAt } : {}),
    currency: "GBP",
    customer: {
      name: clip(order.contact.name ?? order.contact.email, LIMITS.name),
      email: order.contact.email,
      phone: order.contact.phone ? clip(order.contact.phone, LIMITS.phone) : null,
    },
    delivery,
    lines,
    totals: {
      subtotalPence: order.totals.subtotalPence + movedPence,
      deliveryPence: order.totals.deliveryPence - movedPence,
      vatPence: order.totals.vatPence,
      totalPence: order.totals.totalPence,
    },
    ...(account
      ? {
          account: {
            creditDays: account.termsDays,
            company: clip(order.trade?.firmName ?? order.contact.name ?? order.contact.email, LIMITS.name),
            ...(account.invoiceEmail ? { accountsEmail: account.invoiceEmail } : {}),
          },
        }
      : {
          payment: {
            amountPence: order.totals.totalPence,
            reference: order.stripe.paymentIntentId ?? order.orderNumber,
            paidAt: paidAt!,
            feePence: options.feePence,
          },
        }),
    links: { order: adminOrderUrl },
  };
}

/* ------------------------------------------------------------------ */
/* Outbound: refunds                                                   */
/* ------------------------------------------------------------------ */

/** Thintent's POST /api/v1/orders/{externalRef}/refunds body. */
export interface ThintentRefundPayload {
  /** Stripe's refund id — Thintent's idempotency key, so a resend is safe. */
  refundRef: string;
  amountPence: number;
  refundedAt: string;
}

/**
 * A refund made in Stripe, as Thintent records it: a credit note born
 * refunded, which moves no money there. Only a succeeded refund is sent —
 * a pending one hasn't reached the customer, a failed one never will.
 */
export function buildThintentRefundPayload(refund: OrderRefund): ThintentRefundPayload {
  if (refund.status !== "succeeded") throw new Error(`Refund ${refund.stripeRefundId} has not succeeded`);
  return {
    refundRef: refund.stripeRefundId,
    amountPence: refund.amountPence,
    refundedAt: refund.refundedAt.toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Inbound: job status webhooks                                        */
/* ------------------------------------------------------------------ */

/** The body of Thintent's `job.updated` webhook — always the job's full current state. */
export interface ThintentJobEvent {
  externalRef: string;
  jobNumber: number | null;
  status: string;
  courier: string | null;
  trackingRef: string | null;
}

const optionalString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/** Null for anything that isn't a well-formed job.updated event. */
export function parseThintentJobEvent(body: unknown): ThintentJobEvent | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  if (raw.event !== "job.updated") return null;
  const externalRef = optionalString(raw.externalRef);
  const status = optionalString(raw.status);
  if (!externalRef || !status) return null;
  return {
    externalRef,
    jobNumber: typeof raw.jobNumber === "number" ? raw.jobNumber : null,
    status,
    courier: optionalString(raw.courier),
    trackingRef: optionalString(raw.trackingRef),
  };
}

/** Thintent's invoice for an account order, as its import answer and `invoice.updated` carry it. */
export interface ThintentInvoice {
  number: string | null;
  url: string | null;
  status: "draft" | "issued" | "partially_paid" | "paid" | "voided";
  dueDate: string | null;
  totalPence: number;
  paidPence: number;
}

const INVOICE_STATES = ["draft", "issued", "partially_paid", "paid", "voided"] as const;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const pence = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;

/** An invoice object from Thintent, or null when it isn't one we understand. */
export function parseThintentInvoice(value: unknown): ThintentInvoice | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const status = INVOICE_STATES.find((state) => state === raw.status);
  const totalPence = pence(raw.totalPence);
  const paidPence = pence(raw.paidPence);
  if (!status || totalPence === null || paidPence === null) return null;
  const number = optionalString(raw.number ?? raw.invoiceNumber);
  const url = optionalString(raw.url);
  const dueDate = optionalString(raw.dueDate);
  return {
    number: number ? number.slice(0, 40) : null,
    url: url && /^https?:\/\//.test(url) ? url.slice(0, 1024) : null,
    status,
    dueDate: dueDate && DATE_ONLY.test(dueDate) ? dueDate : null,
    totalPence,
    paidPence,
  };
}

/** Thintent's `invoice.updated` webhook — the invoice's whole current state. */
export interface ThintentInvoiceEvent {
  externalRef: string;
  invoice: ThintentInvoice;
  occurredAt: Date;
}

/** Null for anything that isn't a well-formed invoice.updated event. */
export function parseThintentInvoiceEvent(body: unknown): ThintentInvoiceEvent | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  if (raw.event !== "invoice.updated") return null;
  const externalRef = optionalString(raw.externalRef);
  const invoice = parseThintentInvoice(raw);
  const occurredAt = typeof raw.occurredAt === "string" ? new Date(raw.occurredAt) : null;
  if (!externalRef || !invoice || !occurredAt || Number.isNaN(occurredAt.getTime())) return null;
  return { externalRef, invoice, occurredAt };
}

/**
 * Whether an invoice event should be applied: only one newer than the last
 * applied (events can arrive out of order), and never a draft — an account
 * order's invoice is issued on import, so a draft is a step backwards.
 */
export function shouldApplyInvoiceEvent(
  event: ThintentInvoiceEvent,
  lastAppliedAt: Date | null,
): boolean {
  if (event.invoice.status === "draft") return false;
  return lastAppliedAt === null || event.occurredAt.getTime() > lastAppliedAt.getTime();
}

/**
 * Which of this site's statuses a Thintent job status means, or null for one
 * that moves nothing here (a pause, review). `pre_press` is where an imported
 * order starts — paid, not yet at the press, which is this site's
 * `awaiting_print`.
 */
export function thintentTargetStatus(jobStatus: string): OrderStatus | null {
  switch (jobStatus) {
    case "pre_press":
      return "awaiting_print";
    case "in_production":
    case "ready_for_dispatch":
      return "in_production";
    case "dispatched":
      return "shipped";
    case "completed":
      return "delivered";
    case "cancelled":
      return "cancelled";
    default:
      return null;
  }
}

/** The fulfilment path a paid order walks; cancelled/refunded sit off it. */
const FORWARD_PATH: readonly OrderStatus[] = ["awaiting_print", "in_production", "shipped", "delivered"];

/**
 * The steps from `current` to `target`, each one a legal transition — so a
 * job that jumped straight to dispatched walks the order through
 * in_production on the way. Empty when the order is already there or past
 * it (a late or re-ordered webhook never moves an order backwards), or when
 * the order is off the path (draft, cancelled, refunded).
 */
export function forwardStatusPath(current: OrderStatus, target: OrderStatus): OrderStatus[] {
  const from = FORWARD_PATH.indexOf(current);
  const to = FORWARD_PATH.indexOf(target);
  if (from === -1 || to <= from) return [];
  const steps = FORWARD_PATH.slice(from + 1, to + 1);
  // The path is written to match ORDER_STATUS_TRANSITIONS; refuse rather than
  // write a move the status machine wouldn't allow if the two ever drift.
  let at = current;
  for (const step of steps) {
    if (!ORDER_STATUS_TRANSITIONS[at].includes(step)) return [];
    at = step;
  }
  return steps;
}

/**
 * Whether an order without a job may be sent to Thintent: paid and still
 * waiting to reach the press. One an admin has already moved on by hand is
 * being handled outside Thintent — sending it would make a second job for
 * work already printed, and lock its status to that job.
 */
export function canSendToThintent(status: OrderStatus): boolean {
  return status === "awaiting_print";
}

/**
 * The status moves one job.updated event makes here, in order:
 *
 * - a cancel cancels an order that hasn't shipped (the status machine's own
 *   rule — a shipped order can't be un-sent; the caller tells staff instead);
 * - a job reopened in Thintent reopens the order, but only when `reopenable`:
 *   paid, and cancelled *by Thintent*. That step (cancelled → awaiting_print)
 *   is deliberately not in ORDER_STATUS_TRANSITIONS — no admin form offers
 *   it, only Thintent undoing its own cancel;
 * - anything else walks forward (forwardStatusPath).
 */
export function thintentStatusMoves(
  current: OrderStatus,
  jobStatus: string,
  reopenable: boolean,
): OrderStatus[] {
  const target = thintentTargetStatus(jobStatus);
  if (!target) return [];
  if (target === "cancelled") {
    // A draft is a basket, never a Thintent job.
    return current !== "draft" && canTransition(current, "cancelled") ? ["cancelled"] : [];
  }
  if (current === "cancelled") {
    return reopenable ? ["awaiting_print", ...forwardStatusPath("awaiting_print", target)] : [];
  }
  return forwardStatusPath(current, target);
}

/** Thintent signs `${t}.${rawBody}` and allows this much clock drift. */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * Check a `Thintent-Signature: t=<unix>,v1=<hex>` header: HMAC-SHA256 of
 * `<t>.<raw body>` with the shared secret, compared in constant time, and
 * recent enough that a captured delivery can't be replayed later.
 */
export function verifyThintentSignature(
  header: string | null,
  rawBody: string,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!header || !secret) return false;
  const parts = new Map(
    header.split(",").map((part) => {
      const at = part.indexOf("=");
      return [part.slice(0, at).trim(), part.slice(at + 1).trim()] as const;
    }),
  );
  const timestamp = Number(parts.get("t"));
  const signature = parts.get("v1");
  if (!Number.isInteger(timestamp) || !signature || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  if (Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
