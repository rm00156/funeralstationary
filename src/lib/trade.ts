/**
 * Trade accounts, the pure half: validating what /admin/trade saves, the
 * family name and reference asked at a trade checkout, and the rules the
 * trade view of /account is drawn with. DB-free, so it unit-tests on its own;
 * src/lib/trade.server.ts is the seam.
 *
 * A trade account is not a different kind of sign-in. A customer signs in by
 * emailed link exactly as before; when the email they proved is listed on a
 * firm (trade_members), /account shows the firm's view instead of a
 * family's.
 */
import { SHOP_TIME_ZONE } from "@/lib/adminDashboard";
import { parseEmail } from "@/lib/checkoutValidation";
import type { PricingData } from "@/lib/orderOfServicePricing";
import type { OrderStatus } from "@/lib/orders";

/** Who is signed in, when their email is on an active firm. */
export interface TradeMembership {
  firmId: number;
  firmName: string;
  /** The person's own name as the admin entered it, if they did. */
  memberName: string | null;
  paymentTermsDays: number | null;
  /** Taken off every print price this person sees and pays; 0 = none. */
  discountPercent: number;
  /** May place orders on account (Thintent invoices them on the terms above). */
  onAccount: boolean;
  /** Where the firm's invoices go; null = the person who ordered. */
  accountsEmail: string | null;
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const clean = (value: unknown): string =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

/** Longest net terms an admin can record, in days. */
export const MAX_PAYMENT_TERMS_DAYS = 120;

/** The largest trade discount an admin can give, so a typo can't give the shop away. */
export const MAX_TRADE_DISCOUNT_PERCENT = 50;

export interface TradeFirmInput {
  name: string;
  paymentTermsDays: number | null;
  /** 0–MAX_TRADE_DISCOUNT_PERCENT, at most two decimal places. */
  discountPercent: number;
  onAccount: boolean;
  accountsEmail: string | null;
}

/**
 * A discount as typed: blank is none, otherwise a percentage from 0 to the
 * maximum with at most two decimal places ("12.5" is fine, "12.345" isn't).
 */
export function parseDiscountPercent(value: unknown): Parsed<number> {
  if (value === undefined || value === null || value === "") return { ok: true, value: 0 };
  const raw = typeof value === "number" ? String(value) : clean(value).replace(/%$/, "").trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(raw) || Number(raw) > MAX_TRADE_DISCOUNT_PERCENT) {
    return {
      ok: false,
      error: `The trade discount must be a percentage from 0 to ${MAX_TRADE_DISCOUNT_PERCENT}, with at most two decimal places.`,
    };
  }
  return { ok: true, value: Number(raw) };
}

/** The firm form on /admin/trade. Blank terms = not agreed yet. */
export function parseTradeFirmInput(body: unknown): Parsed<TradeFirmInput> {
  const raw = (body ?? {}) as Record<string, unknown>;
  const name = clean(raw.name);
  if (!name) return { ok: false, error: "Please enter the firm's name." };
  if (name.length > 160) return { ok: false, error: "That name is too long." };

  const terms = raw.paymentTermsDays;
  let paymentTermsDays: number | null = null;
  if (terms !== undefined && terms !== null && terms !== "") {
    const days = typeof terms === "number" ? terms : Number(clean(terms));
    if (!Number.isInteger(days) || days < 0 || days > MAX_PAYMENT_TERMS_DAYS) {
      return {
        ok: false,
        error: `Payment terms must be a whole number of days from 0 to ${MAX_PAYMENT_TERMS_DAYS}.`,
      };
    }
    paymentTermsDays = days;
  }
  const discount = parseDiscountPercent(raw.discountPercent);
  if (!discount.ok) return discount;
  const onAccount = raw.onAccount === true;
  let accountsEmail: string | null = null;
  if (typeof raw.accountsEmail === "string" && raw.accountsEmail.trim()) {
    accountsEmail = parseEmail(raw.accountsEmail);
    if (!accountsEmail) return { ok: false, error: "The accounts email doesn’t look right." };
  }
  // Ordering on account needs terms to invoice on.
  if (onAccount && paymentTermsDays === null) {
    return { ok: false, error: "Set the payment terms before allowing orders on account." };
  }
  return {
    ok: true,
    value: { name, paymentTermsDays, discountPercent: discount.value, onAccount, accountsEmail },
  };
}

/**
 * The price table a trade customer sees: every page-count rate cut by the
 * discount. Applied to the rate — not to each quote — so the one rounding
 * getQuote already does stays the only rounding, and every price drawn from
 * this table (the buy box, the price table, "from £X", the basket, Stripe)
 * agrees. Delivery stays full price. No discount, the same table back.
 */
export function withTradeDiscount(data: PricingData, discountPercent: number): PricingData {
  if (!(discountPercent > 0)) return data;
  const factor = (100 - discountPercent) / 100;
  return {
    ...data,
    pages: data.pages.map((option) => ({ ...option, baseRatePence: option.baseRatePence * factor })),
  };
}

/** "10% off" / "12.5% off" — how a discount is written to the customer. */
export const tradeDiscountText = (discountPercent: number) =>
  `${Number(discountPercent.toFixed(2))}% off`;

export interface TradeMemberInput {
  email: string;
  name: string | null;
}

/** Adding a person to a firm. The email is lowercased, as users.email is. */
export function parseTradeMemberInput(body: unknown): Parsed<TradeMemberInput> {
  const raw = (body ?? {}) as Record<string, unknown>;
  const email = parseEmail(raw.email);
  if (!email) return { ok: false, error: "Please enter a valid email address." };
  const name = clean(raw.name);
  if (name.length > 120) return { ok: false, error: "That name is too long." };
  return { ok: true, value: { email, name: name || null } };
}

export interface TradeOrderDetails {
  familyName: string;
  customerRef: string | null;
}

/**
 * The trade checkout's two extra fields. The family name is required — it is
 * how a firm finds the order again among dozens — and the reference is the
 * firm's own, optional.
 */
export function parseTradeOrderDetails(body: unknown): Parsed<TradeOrderDetails> {
  const raw = (body ?? {}) as Record<string, unknown>;
  const familyName = clean(raw.familyName);
  if (!familyName) return { ok: false, error: "Please enter the family's name" };
  if (familyName.length > 160) return { ok: false, error: "The family's name is too long" };
  const customerRef = clean(raw.customerRef);
  if (customerRef.length > 60) return { ok: false, error: "Your reference is too long" };
  return { ok: true, value: { familyName, customerRef: customerRef || null } };
}

/** "Good morning" by the shop's clock (Europe/London), whatever zone the server runs in. */
export function greeting(now: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: SHOP_TIME_ZONE, hour: "numeric", hourCycle: "h23" }).format(now),
  );
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** "Monday 12 October", in the shop's zone. */
export function longShopDate(now: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SHOP_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
}

/** The trade orders table's tabs. There is no "needs your approval": no proof loop. */
export const TRADE_ORDER_TABS = [
  { id: "all", label: "All" },
  { id: "in-progress", label: "In progress" },
  { id: "delivered", label: "Delivered" },
] as const;
export type TradeOrderTab = (typeof TRADE_ORDER_TABS)[number]["id"];

const IN_PROGRESS: ReadonlySet<OrderStatus> = new Set(["awaiting_print", "in_production", "shipped"]);

/** Which tab an order counts under besides All. Cancelled and refunded are in All only. */
export function tradeTabOf(status: OrderStatus): Exclude<TradeOrderTab, "all"> | null {
  if (IN_PROGRESS.has(status)) return "in-progress";
  if (status === "delivered") return "delivered";
  return null;
}

export interface SearchableTradeOrder {
  status: OrderStatus;
  orderNumber: string;
  familyName: string | null;
  customerRef: string | null;
}

const fold = (value: string) => value.toLocaleLowerCase("en-GB").replace(/\s+/g, " ").trim();

/**
 * The orders a tab and a search show. The search matches the family name,
 * the firm's reference and our order number, case- and spacing-insensitively,
 * and "Harper" finds "The Harper family".
 */
export function filterTradeOrders<T extends SearchableTradeOrder>(
  orders: readonly T[],
  tab: TradeOrderTab,
  query: string,
): T[] {
  const needle = fold(query);
  return orders.filter((order) => {
    if (tab !== "all" && tradeTabOf(order.status) !== tab) return false;
    if (!needle) return true;
    return [order.familyName, order.customerRef, order.orderNumber].some(
      (field) => field != null && fold(field).includes(needle),
    );
  });
}

/** How many orders each tab holds, for its count badge. */
export function tradeTabCounts(orders: readonly { status: OrderStatus }[]): Record<TradeOrderTab, number> {
  const counts: Record<TradeOrderTab, number> = { all: orders.length, "in-progress": 0, delivered: 0 };
  for (const order of orders) {
    const tab = tradeTabOf(order.status);
    if (tab) counts[tab] += 1;
  }
  return counts;
}

/** A firm or member id from a URL segment: a positive whole number, else null. */
export function parseTradeId(segment: string): number | null {
  if (!/^[1-9]\d{0,9}$/.test(segment)) return null;
  const id = Number(segment);
  return id <= 2_147_483_647 ? id : null;
}

/**
 * An admin approving a /trade application: into a new firm (named and
 * termed in the same step — the name starts as the business name typed), or
 * onto a firm that already exists, for a colleague applying.
 */
export type TradeApproval =
  | ({ kind: "new" } & TradeFirmInput)
  | { kind: "existing"; firmId: number };

export function parseTradeApproval(body: unknown): Parsed<TradeApproval> {
  const raw = (body ?? {}) as Record<string, unknown>;
  if (raw.kind === "existing") {
    const firmId = typeof raw.firmId === "number" ? raw.firmId : parseTradeId(String(raw.firmId ?? ""));
    if (!firmId || !Number.isInteger(firmId) || firmId < 1) {
      return { ok: false, error: "Choose the firm to add them to." };
    }
    return { ok: true, value: { kind: "existing", firmId } };
  }
  if (raw.kind !== "new") return { ok: false, error: "Choose a new firm or an existing one." };
  const firm = parseTradeFirmInput(raw);
  return firm.ok ? { ok: true, value: { kind: "new", ...firm.value } } : firm;
}

/** A staff-only note on a decision. Blank = none. */
export function parseDecisionNote(value: unknown): Parsed<string | null> {
  const note = typeof value === "string" ? value.trim() : "";
  if (note.length > 2000) return { ok: false, error: "Please keep the note under 2,000 characters." };
  return { ok: true, value: note || null };
}

/** An application id from a URL: a UUID, as crypto.randomUUID makes them. */
export const isTradeApplicationId = (segment: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment);

export type PayWith = "card" | "account";

/**
 * How a checkout is paid. Card unless the form asked for account — and only
 * a firm an admin let order on account may (TradeMembership.onAccount, which
 * also needs terms). Anyone else asking for it is refused, not quietly sent
 * to the card page.
 */
export function resolvePayWith(
  value: unknown,
  membership: Pick<TradeMembership, "onAccount"> | null,
): Parsed<PayWith> {
  if (value === undefined || value === null || value === "card") return { ok: true, value: "card" };
  if (value !== "account") return { ok: false, error: "Choose how to pay" };
  if (!membership?.onAccount) {
    return { ok: false, error: "This account can't order on account. Please pay by card." };
  }
  return { ok: true, value: "account" };
}

/** An order as the Invoices panel sees it: account orders only matter. */
export interface InvoiceableOrder {
  status: OrderStatus;
  paymentMethod: "card" | "account";
  totalPence: number;
  invoice: { status: string | null; dueDate: string | null; paidPence: number } | null;
}

const settled = (order: InvoiceableOrder) =>
  order.status === "cancelled" ||
  order.status === "refunded" ||
  order.invoice?.status === "paid" ||
  order.invoice?.status === "voided";

/**
 * What the firm owes on account: every account order not paid, voided or
 * cancelled, less anything paid towards it — and of that, what's past its
 * due date (`today` is the shop's yyyy-mm-dd). An order whose invoice hasn't
 * come back from Thintent yet is owed but not overdue.
 */
export function accountBalance(
  orders: readonly InvoiceableOrder[],
  today: string,
): { owedPence: number; overduePence: number; overdueCount: number } {
  let owedPence = 0;
  let overduePence = 0;
  let overdueCount = 0;
  for (const order of orders) {
    if (order.paymentMethod !== "account" || settled(order)) continue;
    const due = Math.max(0, order.totalPence - (order.invoice?.paidPence ?? 0));
    owedPence += due;
    if (order.invoice?.dueDate && order.invoice.dueDate < today) {
      overduePence += due;
      overdueCount += 1;
    }
  }
  return { owedPence, overduePence, overdueCount };
}

/** "Paid", "Due 14 Nov", "Overdue · was due 3 Nov", "Part paid · due 14 Nov", "Invoice on its way". */
export function invoiceStatusText(order: InvoiceableOrder, today: string): string {
  const invoice = order.invoice;
  if (!invoice || !invoice.status || invoice.status === "draft") return "Invoice on its way";
  if (invoice.status === "paid") return "Paid";
  if (invoice.status === "voided") return "Cancelled";
  const due = invoice.dueDate
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
        new Date(`${invoice.dueDate}T00:00:00Z`),
      )
    : null;
  if (invoice.dueDate && invoice.dueDate < today) return `Overdue · was due ${due}`;
  const prefix = invoice.status === "partially_paid" ? "Part paid" : "Due";
  return due ? (prefix === "Due" ? `Due ${due}` : `${prefix} · due ${due}`) : prefix === "Due" ? "Unpaid" : prefix;
}
