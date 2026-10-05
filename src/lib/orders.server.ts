/**
 * Server-side reads/writes for baskets and orders.
 *
 * The basket is not its own table: it is the owner's newest `orders` row with
 * status = "draft" (see the note in src/db/schema/orders.ts). Every query is
 * scoped by owner exactly as designs.server.ts scopes designs, and — same
 * seam discipline — nothing here ever exposes a surrogate id: the spec
 * columns on order_items are slug snapshots, and the catalogue is only ever
 * consulted through the slug-based pricing loader.
 *
 * Pricing is always done here, never trusted from the client: a line carries
 * slugs, and the price is recomputed from the live catalogue through the
 * strict resolver (a deactivated option makes the line *stale* rather than
 * silently repricing it). Snapshots (doc + quote) become authoritative only
 * at the pay click, in prepareOrderForPayment().
 *
 * Every axis, delivery included, belongs to the line: delivery options are
 * product-scoped and a line is its own print job, so a basket can mix
 * products and each line is priced against its own product's catalogue.
 *
 * Nothing in this module touches Chromium or email — those side effects live
 * in orderFulfilment.server.ts so the basket routes don't trace them in.
 */
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { isDuplicateKeyError } from "@/db/errors";
import { designs, orderEvents, orderItems, orderProofPages, orderProofs, orders } from "@/db/schema";
import type { CheckoutDetails } from "@/lib/checkoutValidation";
import { getProductFormats } from "@/lib/catalogue.server";
import {
  BOOKLET_FORMAT,
  docTrim,
  type DesignDoc,
  type PageTrim,
  type ProductFormat,
} from "@/lib/designEditor";
import { getDesign } from "@/lib/designs.server";
import {
  describeIssue,
  isDesignOrderable,
  needsDefaultsConfirmation,
} from "@/lib/designReadiness";
import { checkDocReadiness } from "@/lib/designReadiness.server";
import type { OrderEmailSummary } from "@/lib/orderEmails";
import {
  DEFAULT_VAT_RATE,
  computeOrderTotals,
  lineSpec,
  makeOrderNumber,
  resolveSelectionStrict,
  vatRateToDecimalString,
  type OrderStatus,
  type OrderTotals,
  type SelectionAxis,
} from "@/lib/orders";
import {
  copiesText,
  defaultSelection,
  type DeliveryOption,
  type PricingData,
  type Quote,
  type Selection,
} from "@/lib/orderOfServicePricing";
// getPricingData is React-cached per request, so pricingByProduct's per-line
// loads collapse to one query set per distinct product.
import { getPageCountOption, getPricingData } from "@/lib/pricing.server";
import type { Owner } from "@/lib/session";

/** A client-caused failure the route can map straight to a status code. */
export class CartError extends Error {
  constructor(
    public readonly status: 400 | 404 | 409,
    message: string,
    /**
     * Extra JSON merged into the error response. Used by the pre-order check
     * so the client gets the actual list of things to fix, not just a
     * sentence — the customer needs to be shown *which* photo window is empty.
     */
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "CartError";
  }
}

/** Route helper: the Response for a CartError / resolver miss, else null. */
export function cartErrorResponse(error: unknown): Response | null {
  if (error instanceof CartError) {
    return Response.json({ error: error.message, ...error.details }, { status: error.status });
  }
  if (error instanceof Error && error.message.startsWith("Unknown")) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Shapes                                                              */
/* ------------------------------------------------------------------ */

export interface CartItem {
  id: string;
  designId: string | null;
  designName: string;
  /** The design was removed after being added; the line can't be bought. */
  designMissing: boolean;
  productId: string;
  productLabel: string;
  /** The product's size and axis names, for the line's spec (lineSpec). */
  format: ProductFormat;
  templateId: string;
  templateName: string;
  templateImage: string | null;
  pageCount: number;
  /** pages/paper follow the live design; quantity/delivery are the line's. */
  selection: Selection;
  /** Live-priced from the catalogue; null while any axis is stale. */
  quote: Quote | null;
  /** Axes whose option no longer exists / is inactive. */
  stale: SelectionAxis[];
  /** Null when the stored option was since deactivated (then also in `stale`). */
  delivery: CartDelivery | null;
  /** This line's product's delivery options, for the basket's picker. */
  deliveryOptions: DeliveryOption[];
  quantityCopies: number;
  unitPricePence: number;
  lineTotalPence: number;
}

export interface CartDelivery {
  optionId: string;
  label: string;
  pricePence: number;
}

export interface Cart {
  id: string;
  orderNumber: string;
  items: CartItem[];
  details: CheckoutDetails | null;
  /** `deliveryPence` is Σ of the lines' delivery charges. */
  totals: OrderTotals;
  /** Everything prices and nothing is missing — checkout may proceed. */
  ready: boolean;
}

export interface OrderProofPageImage {
  pageIndex: number;
  imageUrl: string;
}

/**
 * A rendered version of a line's artwork. Admin-only, in full: proofs are a
 * press artefact, and nothing on the customer path reads them.
 */
export interface OrderProofSummary {
  id: string;
  version: number;
  /** The print-ready PDF — null until an admin generates one. */
  pdfUrl: string | null;
  pages: OrderProofPageImage[];
  createdAt: Date;
}

export interface OrderDetailItem {
  id: string;
  designId: string | null;
  designName: string;
  productId: string;
  format: ProductFormat;
  /** The trim the press artwork is drawn at — the snapshot's own, not the product's today. */
  artworkTrim: PageTrim;
  templateId: string;
  pageCount: number;
  quote: Quote;
  quantityCopies: number;
  unitPricePence: number;
  lineTotalPence: number;
  delivery: CartDelivery;
  proofs: OrderProofSummary[];
}

export interface OrderEvent {
  id: number;
  type: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  actor: string | null;
  createdAt: Date;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  placedAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  contact: { name: string | null; email: string | null; phone: string | null };
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    postcode: string | null;
    country: string;
  };
  totals: OrderTotals;
  items: OrderDetailItem[];
  events: OrderEvent[];
  stripe: { checkoutSessionId: string | null; paymentIntentId: string | null };
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  placedAt: Date | null;
  totalPence: number;
  itemCount: number;
}

/** What Stripe is asked to charge — the output of prepareOrderForPayment. */
export interface FrozenOrder {
  id: string;
  orderNumber: string;
  contactEmail: string;
  items: {
    id: string;
    name: string;
    unitPricePence: number;
    copies: number;
    delivery: { label: string; pricePence: number };
  }[];
  totals: OrderTotals;
}

/* ------------------------------------------------------------------ */
/* Internals                                                           */
/* ------------------------------------------------------------------ */

/** Owner predicate: a signed-in customer by user_id, a guest by guest_token. */
function ownedBy(owner: Owner) {
  return owner.userId === null
    ? eq(orders.guestToken, owner.guestToken)
    : eq(orders.userId, owner.userId);
}

type OrderRow = typeof orders.$inferSelect;
type OrderItemRow = typeof orderItems.$inferSelect;

async function findDraftOrder(owner: Owner): Promise<OrderRow | null> {
  const [row] = await db
    .select()
    .from(orders)
    .where(and(ownedBy(owner), eq(orders.status, "draft")))
    .orderBy(desc(orders.createdAt))
    .limit(1);
  return row ?? null;
}

async function getOrCreateDraftOrder(owner: Owner): Promise<OrderRow> {
  const existing = await findDraftOrder(owner);
  if (existing) return existing;

  const id = crypto.randomUUID();
  const year = new Date().getUTCFullYear();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await db.insert(orders).values({
        id,
        orderNumber: makeOrderNumber(year),
        userId: owner.userId,
        guestToken: owner.userId ? null : owner.guestToken,
      });
      break;
    } catch (error) {
      if (!isDuplicateKeyError(error) || attempt === 4) throw error;
    }
  }
  const created = await findDraftOrder(owner);
  if (!created) throw new Error("Basket vanished immediately after insert");
  return created;
}

async function listDraftItems(orderId: string): Promise<OrderItemRow[]> {
  return db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(asc(orderItems.position), asc(orderItems.createdAt));
}

function detailsFrom(order: OrderRow): CheckoutDetails | null {
  if (
    !order.contactName ||
    !order.contactEmail ||
    !order.addressLine1 ||
    !order.city ||
    !order.postcode
  ) {
    return null;
  }
  return {
    contactName: order.contactName,
    contactEmail: order.contactEmail,
    contactPhone: order.contactPhone,
    addressLine1: order.addressLine1,
    addressLine2: order.addressLine2,
    city: order.city,
    postcode: order.postcode,
  };
}

/** A line's delivery option, if it is still live in its product's catalogue. */
function resolveDelivery(item: OrderItemRow, pricing: PricingData): CartDelivery | null {
  if (!item.deliveryOptionId) return null;
  const option = pricing.delivery.find((candidate) => candidate.id === item.deliveryOptionId);
  return option ? { optionId: option.id, label: option.label, pricePence: option.pricePence } : null;
}

/**
 * The delivery to start a new line on: what the customer already chose for
 * another line of the same product (so a second booklet doesn't silently
 * revert to standard post), else the product's default.
 */
function initialDeliverySlug(
  existing: OrderItemRow[],
  productId: string,
  pricing: PricingData,
): string {
  const sibling = existing.find(
    (item) => item.productId === productId && resolveDelivery(item, pricing),
  );
  return sibling?.deliveryOptionId ?? defaultSelection(pricing).delivery;
}

/** One PricingData per product present in the lines; the loader is React-cached. */
async function pricingByProduct(items: OrderItemRow[]): Promise<Map<string, PricingData>> {
  const slugs = [...new Set(items.map((item) => item.productId))];
  const loaded = await Promise.all(slugs.map((slug) => getPricingData(slug)));
  return new Map(slugs.map((slug, index) => [slug, loaded[index]]));
}

async function insertEvent(
  orderId: string,
  event: { type: string; fromStatus?: string | null; toStatus?: string | null; note?: string | null; actor?: string },
): Promise<void> {
  await db.insert(orderEvents).values({
    orderId,
    type: event.type,
    fromStatus: event.fromStatus ?? null,
    toStatus: event.toStatus ?? null,
    note: event.note ?? null,
    actor: event.actor ?? "system",
  });
}

/** Append an audit-trail row. Exported for fulfilment and the admin seam. */
export const addOrderEvent = insertEvent;

/* ------------------------------------------------------------------ */
/* Basket                                                              */
/* ------------------------------------------------------------------ */

export async function getCart(owner: Owner): Promise<Cart | null> {
  const order = await findDraftOrder(owner);
  if (!order) return null;

  const rows = await listDraftItems(order.id);

  // Live designs are what's shown and priced; the row's own slugs are only a
  // fallback for a line whose design has since been removed. Owner-scoped
  // getDesign also excludes soft-deleted rows, which is exactly the
  // "missing" signal the basket needs.
  const liveDesigns = new Map<string, Awaited<ReturnType<typeof getDesign>>>();
  for (const item of rows) {
    if (item.designId) liveDesigns.set(item.designId, await getDesign(owner, item.designId));
  }

  const [pricings, formats] = await Promise.all([pricingByProduct(rows), getProductFormats()]);

  const items: CartItem[] = rows.map((item) => {
    const design = item.designId ? liveDesigns.get(item.designId) ?? null : null;
    const pricing = pricings.get(item.productId)!;
    const selection: Selection = {
      quantity: item.quantityOptionId ?? "",
      pages: design?.pagesOptionId ?? item.pageCountOptionId ?? "",
      paper: design?.paperId ?? item.paperOptionId ?? "",
      delivery: item.deliveryOptionId ?? "",
    };
    const resolved = resolveSelectionStrict(pricing, selection);
    const quote = resolved.ok ? resolved.quote : null;
    return {
      id: item.id,
      designId: item.designId,
      designName: design?.name ?? "Removed design",
      designMissing: !design,
      productId: item.productId,
      productLabel: design?.productLabel ?? item.productId,
      format: formats.get(item.productId) ?? BOOKLET_FORMAT,
      templateId: design?.templateId ?? item.templateId,
      templateName: design?.templateName ?? item.templateId,
      templateImage: design?.templateImage ?? null,
      pageCount: design?.pageCount ?? item.docSnapshot.pages.length,
      selection,
      quote,
      stale: resolved.ok ? [] : resolved.invalid,
      delivery: resolveDelivery(item, pricing),
      deliveryOptions: pricing.delivery,
      quantityCopies: quote?.quantity.value ?? item.quantityCopies,
      unitPricePence: quote?.unitPricePence ?? item.unitPricePence,
      lineTotalPence: quote?.printCostPence ?? item.lineTotalPence,
    };
  });

  const totals = computeOrderTotals(
    items.map((item) => item.lineTotalPence),
    items.reduce((sum, item) => sum + (item.delivery?.pricePence ?? 0), 0),
  );
  const ready =
    items.length > 0 &&
    items.every((item) => !item.designMissing && item.stale.length === 0);

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    items,
    details: detailsFrom(order),
    totals,
    ready,
  };
}

/** Number of lines in the basket — for the header badge; no cookie minting. */
export async function getCartCount(owner: Owner): Promise<number> {
  const order = await findDraftOrder(owner);
  if (!order) return 0;
  const rows = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));
  return rows.length;
}

type LineChoice = Partial<Pick<Selection, "quantity" | "delivery">>;

interface AddCartItemOptions extends LineChoice {
  /**
   * The customer has been shown the template wording they left unedited and
   * has confirmed they meant to keep it. Without this an otherwise valid
   * design is refused, so the confirmation can never be skipped by a client
   * that simply doesn't implement the dialog.
   */
  acknowledgeDefaults?: boolean;
}

function assertLineChoiceValid(
  pricing: PricingData,
  selection: Selection,
): Quote {
  const resolved = resolveSelectionStrict(pricing, selection);
  if (!resolved.ok) {
    const axis = resolved.invalid[0];
    throw new CartError(400, `Unknown ${axis} option "${selection[axis]}"`);
  }
  return resolved.quote;
}

/**
 * Add a design to the basket. Idempotent per design — adding twice returns
 * the existing line. Lines from different products sit side by side, each
 * with its own delivery.
 */
export async function addCartItem(
  owner: Owner,
  designId: string,
  choice: AddCartItemOptions = {},
): Promise<Cart> {
  const design = await getDesign(owner, designId);
  if (!design) throw new CartError(404, "Design not found");

  const order = await getOrCreateDraftOrder(owner);
  const existing = await listDraftItems(order.id);

  if (existing.some((item) => item.designId === design.id)) {
    const cart = await getCart(owner);
    if (!cart) throw new Error("Basket vanished");
    return cart;
  }

  /*
   * The pre-order gate. Everything a proof review would have caught is caught
   * here instead, while the customer is still in front of the editor and can
   * fix it themselves: an empty photo window is refused outright (it prints as
   * the editor's dashed placeholder), and template wording left unedited must
   * be confirmed. Enforced server-side because the client's copy of this check
   * is a nicety, not a gate.
   */
  const readiness = await checkDocReadiness(design.templateId, design.doc);
  if (!isDesignOrderable(readiness)) {
    throw new CartError(409, readiness.blocking.map(describeIssue).join(". "), {
      reason: "blocked",
      readiness,
    });
  }
  if (needsDefaultsConfirmation(readiness) && !choice.acknowledgeDefaults) {
    throw new CartError(409, "Please confirm the wording you have left unchanged", {
      reason: "confirm",
      readiness,
    });
  }

  const pricing = await getPricingData(design.productId);
  const base = defaultSelection(pricing);
  const selection: Selection = {
    quantity: choice.quantity ?? base.quantity,
    pages: design.pagesOptionId,
    paper: design.paperId,
    delivery: choice.delivery ?? initialDeliverySlug(existing, design.productId, pricing),
  };
  const quote = assertLineChoiceValid(pricing, selection);

  await db.insert(orderItems).values({
    id: crypto.randomUUID(),
    orderId: order.id,
    designId: design.id,
    position: existing.length,
    productId: design.productId,
    templateId: design.templateId,
    quantityOptionId: selection.quantity,
    pageCountOptionId: selection.pages,
    paperOptionId: selection.paper,
    deliveryOptionId: selection.delivery,
    deliveryLabel: quote.delivery.label,
    deliveryPricePence: quote.delivery.pricePence,
    quoteSnapshot: quote,
    quantityCopies: quote.quantity.value,
    unitPricePence: quote.unitPricePence,
    lineTotalPence: quote.printCostPence,
    docSnapshot: design.doc,
    // The audit record: what they were warned about, and when they accepted
    // it. Null when there was nothing to warn about at all.
    defaultsAck: readiness.warnings.length > 0 ? readiness.warnings : null,
    defaultsAckAt: readiness.warnings.length > 0 ? new Date() : null,
  });

  const cart = await getCart(owner);
  if (!cart) throw new Error("Basket vanished immediately after insert");
  return cart;
}

async function getOwnedDraftItem(owner: Owner, itemId: string) {
  const order = await findDraftOrder(owner);
  if (!order) throw new CartError(404, "Basket item not found");
  const [item] = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, order.id)))
    .limit(1);
  if (!item) throw new CartError(404, "Basket item not found");
  return { order, item };
}

/** Change a line's quantity/delivery. Reprices from the live catalogue. */
export async function updateCartItem(
  owner: Owner,
  itemId: string,
  choice: LineChoice,
): Promise<Cart> {
  const { item } = await getOwnedDraftItem(owner, itemId);
  const design = item.designId ? await getDesign(owner, item.designId) : null;
  if (!design) {
    throw new CartError(409, "That design has been removed — take it out of your basket");
  }

  const pricing = await getPricingData(design.productId);
  const selection: Selection = {
    quantity: choice.quantity ?? item.quantityOptionId ?? "",
    pages: design.pagesOptionId,
    paper: design.paperId,
    delivery: choice.delivery ?? item.deliveryOptionId ?? "",
  };
  const quote = assertLineChoiceValid(pricing, selection);

  await db
    .update(orderItems)
    .set({
      quantityOptionId: selection.quantity,
      pageCountOptionId: selection.pages,
      paperOptionId: selection.paper,
      deliveryOptionId: selection.delivery,
      deliveryLabel: quote.delivery.label,
      deliveryPricePence: quote.delivery.pricePence,
      quoteSnapshot: quote,
      quantityCopies: quote.quantity.value,
      unitPricePence: quote.unitPricePence,
      lineTotalPence: quote.printCostPence,
      docSnapshot: design.doc,
    })
    .where(eq(orderItems.id, item.id));

  const cart = await getCart(owner);
  if (!cart) throw new Error("Basket vanished");
  return cart;
}

export async function removeCartItem(owner: Owner, itemId: string): Promise<Cart> {
  const { item } = await getOwnedDraftItem(owner, itemId);
  await db.delete(orderItems).where(eq(orderItems.id, item.id));
  const cart = await getCart(owner);
  if (!cart) throw new Error("Basket vanished");
  return cart;
}

export async function setCheckoutDetails(owner: Owner, details: CheckoutDetails): Promise<Cart> {
  const order = await findDraftOrder(owner);
  if (!order) throw new CartError(404, "Your basket is empty");
  await db
    .update(orders)
    .set({
      contactName: details.contactName,
      contactEmail: details.contactEmail,
      contactPhone: details.contactPhone,
      guestEmail: owner.userId ? null : details.contactEmail,
      addressLine1: details.addressLine1,
      addressLine2: details.addressLine2,
      city: details.city,
      postcode: details.postcode,
      country: "GB",
    })
    .where(eq(orders.id, order.id));
  const cart = await getCart(owner);
  if (!cart) throw new Error("Basket vanished");
  return cart;
}

/* ------------------------------------------------------------------ */
/* Checkout                                                            */
/* ------------------------------------------------------------------ */

export type PrepareResult =
  | { ok: true; order: FrozenOrder }
  | { ok: false; status: 400 | 409; error: string; itemId?: string };

/**
 * The pay click. Re-reads every line against the live design and catalogue,
 * refuses anything that no longer prices, and rewrites the snapshots and
 * totals inside one transaction so that what Stripe charges is exactly what
 * the row says. After this the draft is frozen until payment resolves.
 */
export async function prepareOrderForPayment(owner: Owner): Promise<PrepareResult> {
  const order = await findDraftOrder(owner);
  if (!order) return { ok: false, status: 400, error: "Your basket is empty" };
  const items = await listDraftItems(order.id);
  if (items.length === 0) return { ok: false, status: 400, error: "Your basket is empty" };

  const details = detailsFrom(order);
  if (!details) return { ok: false, status: 400, error: "Please enter your delivery details" };

  const [pricings, formats] = await Promise.all([pricingByProduct(items), getProductFormats()]);

  const frozenLines: {
    item: OrderItemRow;
    selection: Selection;
    quote: Quote;
    doc: DesignDoc;
    format: ProductFormat;
    name: string;
  }[] = [];

  for (const item of items) {
    const design = item.designId ? await getDesign(owner, item.designId) : null;
    if (!design) {
      return {
        ok: false,
        status: 409,
        error: "A design in your basket has been removed — please take it out to continue",
        itemId: item.id,
      };
    }
    // The page-count invariant (doc.pages.length === option.pageCount) is
    // enforced on every design save; re-check it here because a page-count
    // option can be deactivated between saving and paying.
    const pageOption = await getPageCountOption(design.productId, design.pagesOptionId);
    if (!pageOption || pageOption.pageCount !== design.pageCount) {
      return {
        ok: false,
        status: 409,
        error: `"${design.name}" needs re-saving — open it in the editor and save it again`,
        itemId: item.id,
      };
    }
    const selection: Selection = {
      quantity: item.quantityOptionId ?? "",
      pages: design.pagesOptionId,
      paper: design.paperId,
      delivery: item.deliveryOptionId ?? "",
    };
    // The line's product, not the design's: the two only differ if the
    // design was re-pointed at another product after being added, and the
    // line's slugs were priced against the product it was added under.
    const resolved = resolveSelectionStrict(pricings.get(item.productId)!, selection);
    if (!resolved.ok) {
      return {
        ok: false,
        status: 409,
        error: `The ${resolved.invalid[0]} chosen for "${design.name}" is no longer available — please choose another`,
        itemId: item.id,
      };
    }
    frozenLines.push({
      item,
      selection,
      quote: resolved.quote,
      doc: design.doc,
      format: formats.get(item.productId) ?? BOOKLET_FORMAT,
      name: `${design.productLabel} — ${design.name}`,
    });
  }

  const totals = computeOrderTotals(
    frozenLines.map((line) => line.quote.printCostPence),
    frozenLines.reduce((sum, line) => sum + line.quote.delivery.pricePence, 0),
    DEFAULT_VAT_RATE,
  );

  await db.transaction(async (tx) => {
    for (const line of frozenLines) {
      await tx
        .update(orderItems)
        .set({
          quantityOptionId: line.selection.quantity,
          pageCountOptionId: line.selection.pages,
          paperOptionId: line.selection.paper,
          deliveryOptionId: line.selection.delivery,
          deliveryLabel: line.quote.delivery.label,
          deliveryPricePence: line.quote.delivery.pricePence,
          quoteSnapshot: line.quote,
          quantityCopies: line.quote.quantity.value,
          unitPricePence: line.quote.unitPricePence,
          lineTotalPence: line.quote.printCostPence,
          docSnapshot: line.doc,
          formatSnapshot: line.format,
        })
        .where(eq(orderItems.id, line.item.id));
    }
    await tx
      .update(orders)
      .set({
        subtotalPence: totals.subtotalPence,
        deliveryPence: totals.deliveryPence,
        vatPence: totals.vatPence,
        vatRate: vatRateToDecimalString(totals.vatRate),
        totalPence: totals.totalPence,
      })
      .where(eq(orders.id, order.id));
  });

  return {
    ok: true,
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      contactEmail: details.contactEmail,
      items: frozenLines.map((line) => ({
        id: line.item.id,
        name: line.name,
        unitPricePence: line.quote.unitPricePence,
        copies: line.quote.quantity.value,
        delivery: {
          label: line.quote.delivery.label,
          pricePence: line.quote.delivery.pricePence,
        },
      })),
      totals,
    },
  };
}

/** Remember which Checkout Session the customer was sent to. */
export async function attachCheckoutSession(orderId: string, sessionId: string): Promise<void> {
  await db
    .update(orders)
    .set({ stripeCheckoutSessionId: sessionId })
    .where(and(eq(orders.id, orderId), eq(orders.status, "draft")));
}

export type FinaliseResult = "finalised" | "already-finalised" | "not-found";

/**
 * Payment completed. Deliberately a single conditional UPDATE keyed on
 * status = "draft": the Stripe webhook and the customer's return redirect
 * both call this and can race, and only the one that flips the row gets to
 * write the "placed" event and trigger side effects. Unscoped by owner — the
 * Checkout Session id is the proof of payment, and the webhook has no cookie.
 */
export async function finaliseOrder(
  orderId: string,
  payment: { sessionId: string; paymentIntentId: string | null; amountTotal: number | null },
): Promise<FinaliseResult> {
  const now = new Date();
  const [result] = await db
    .update(orders)
    .set({
      status: "awaiting_print",
      placedAt: now,
      paidAt: now,
      stripeCheckoutSessionId: payment.sessionId,
      stripePaymentIntentId: payment.paymentIntentId,
    })
    .where(and(eq(orders.id, orderId), eq(orders.status, "draft")));

  if (result.affectedRows === 0) {
    const [row] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    return row ? "already-finalised" : "not-found";
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  await insertEvent(orderId, {
    type: "placed",
    fromStatus: "draft",
    toStatus: "awaiting_print",
    actor: "stripe",
    note: `Paid via Stripe Checkout (${payment.sessionId})`,
  });
  if (order && payment.amountTotal !== null && payment.amountTotal !== order.totalPence) {
    await insertEvent(orderId, {
      type: "payment_amount_mismatch",
      actor: "stripe",
      note: `Stripe charged ${payment.amountTotal}p but the order total is ${order.totalPence}p`,
    });
  }

  const items = await listDraftItems(orderId);
  const designIds = items.flatMap((item) => (item.designId ? [item.designId] : []));
  if (designIds.length > 0) {
    await db.update(designs).set({ status: "ordered" }).where(inArray(designs.id, designIds));
  }
  return "finalised";
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export async function listOrders(owner: Owner): Promise<OrderSummary[]> {
  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      placedAt: orders.placedAt,
      totalPence: orders.totalPence,
    })
    .from(orders)
    .where(and(ownedBy(owner), ne(orders.status, "draft")))
    .orderBy(desc(orders.placedAt), desc(orders.createdAt));
  if (rows.length === 0) return [];

  const counts = await db
    .select({ orderId: orderItems.orderId, id: orderItems.id })
    .from(orderItems)
    .where(inArray(orderItems.orderId, rows.map((row) => row.id)));
  const countByOrder = new Map<string, number>();
  for (const row of counts) {
    countByOrder.set(row.orderId, (countByOrder.get(row.orderId) ?? 0) + 1);
  }
  return rows.map((row) => ({ ...row, itemCount: countByOrder.get(row.id) ?? 0 }));
}

/**
 * Full order read. With an owner it is scoped (a stranger's order reads as
 * missing, never forbidden); without one it is the admin/fulfilment read.
 */
export async function loadOrderDetail(id: string, owner?: Owner): Promise<OrderDetail | null> {
  const [order] = await db
    .select()
    .from(orders)
    .where(owner ? and(eq(orders.id, id), ownedBy(owner)) : eq(orders.id, id))
    .limit(1);
  if (!order) return null;

  // Soft-deleted designs are joined on purpose: the order outlives the design.
  const [itemRows, proofRows, eventRows, formats] = await Promise.all([
    db
      .select({ item: orderItems, designName: designs.name })
      .from(orderItems)
      .leftJoin(designs, eq(orderItems.designId, designs.id))
      .where(eq(orderItems.orderId, order.id))
      .orderBy(asc(orderItems.position), asc(orderItems.createdAt)),
    db
      .select()
      .from(orderProofs)
      .where(
        inArray(
          orderProofs.orderItemId,
          db.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.orderId, order.id)),
        ),
      )
      .orderBy(desc(orderProofs.version)),
    db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.orderId, order.id))
      .orderBy(desc(orderEvents.createdAt), desc(orderEvents.id)),
    getProductFormats(),
  ]);

  // Only worth a round trip once there is something to page through.
  const pageRows = proofRows.length
    ? await db
        .select()
        .from(orderProofPages)
        .where(
          inArray(
            orderProofPages.proofId,
            proofRows.map((proof) => proof.id),
          ),
        )
        .orderBy(asc(orderProofPages.pageIndex))
    : [];
  const pagesByProof = new Map<string, OrderProofPageImage[]>();
  for (const row of pageRows) {
    const list = pagesByProof.get(row.proofId) ?? [];
    list.push({ pageIndex: row.pageIndex, imageUrl: row.imageUrl });
    pagesByProof.set(row.proofId, list);
  }

  const proofsByItem = new Map<string, OrderProofSummary[]>();
  for (const proof of proofRows) {
    const list = proofsByItem.get(proof.orderItemId) ?? [];
    list.push({
      id: proof.id,
      version: proof.version,
      pdfUrl: proof.pdfUrl,
      pages: pagesByProof.get(proof.id) ?? [],
      createdAt: proof.createdAt,
    });
    proofsByItem.set(proof.orderItemId, list);
  }

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    placedAt: order.placedAt,
    paidAt: order.paidAt,
    createdAt: order.createdAt,
    contact: { name: order.contactName, email: order.contactEmail, phone: order.contactPhone },
    address: {
      line1: order.addressLine1,
      line2: order.addressLine2,
      city: order.city,
      postcode: order.postcode,
      country: order.country,
    },
    totals: {
      subtotalPence: order.subtotalPence,
      deliveryPence: order.deliveryPence,
      vatPence: order.vatPence,
      vatRate: Number(order.vatRate),
      totalPence: order.totalPence,
    },
    items: itemRows.map(({ item, designName }) => ({
      id: item.id,
      designId: item.designId,
      designName: designName ?? "Design",
      productId: item.productId,
      // History reads the format the line was paid under; only a line paid
      // before that was snapshotted falls back to the live one.
      format: item.formatSnapshot ?? formats.get(item.productId) ?? BOOKLET_FORMAT,
      artworkTrim: docTrim(item.docSnapshot),
      templateId: item.templateId,
      pageCount: item.docSnapshot.pages.length,
      quote: item.quoteSnapshot,
      quantityCopies: item.quantityCopies,
      unitPricePence: item.unitPricePence,
      lineTotalPence: item.lineTotalPence,
      // The snapshot columns are authoritative; the quote snapshot is only a
      // fallback for a line frozen before they existed.
      delivery: {
        optionId: item.deliveryOptionId ?? item.quoteSnapshot.delivery.id,
        label: item.deliveryLabel ?? item.quoteSnapshot.delivery.label,
        pricePence: item.deliveryPricePence ?? item.quoteSnapshot.delivery.pricePence,
      },
      proofs: proofsByItem.get(item.id) ?? [],
    })),
    events: eventRows.map((event) => ({
      id: event.id,
      type: event.type,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      note: event.note,
      actor: event.actor,
      createdAt: event.createdAt,
    })),
    stripe: {
      checkoutSessionId: order.stripeCheckoutSessionId,
      paymentIntentId: order.stripePaymentIntentId,
    },
  };
}

/** A placed order of the caller's. Drafts are the basket, not an order. */
export async function getOrder(owner: Owner, id: string): Promise<OrderDetail | null> {
  const detail = await loadOrderDetail(id, owner);
  return detail && detail.status !== "draft" ? detail : null;
}

/** The plain summary the confirmation/notification emails are built from. */
export async function getOrderEmailSummary(orderId: string): Promise<OrderEmailSummary | null> {
  const order = await loadOrderDetail(orderId);
  if (!order || !order.contact.email) return null;
  return {
    orderNumber: order.orderNumber,
    contactName: order.contact.name ?? "",
    contactEmail: order.contact.email,
    items: order.items.map((item) => ({
      name: item.designName,
      spec: `${copiesText(item.quantityCopies)} · ${lineSpec(item.format, item.quote)}`,
      copies: item.quantityCopies,
      lineTotalPence: item.lineTotalPence,
      deliveryLabel: item.delivery.label,
      deliveryPence: item.delivery.pricePence,
    })),
    deliveryPence: order.totals.deliveryPence,
    subtotalPence: order.totals.subtotalPence,
    vatPence: order.totals.vatPence,
    totalPence: order.totals.totalPence,
    addressLines: [
      order.contact.name,
      order.address.line1,
      order.address.line2,
      order.address.city,
      order.address.postcode,
    ].filter((line): line is string => !!line),
  };
}

