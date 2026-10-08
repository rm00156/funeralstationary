/**
 * The admin "Today" page's rules — what counts as urgent, what must leave
 * today, and how the takings add up. Pure and unit-tested (same discipline as
 * orders.ts); adminDashboard.server.ts gathers the facts and calls these.
 *
 * Every "today" here is the shop's day in Beckenham, so dates are worked out
 * in Europe/London whatever zone the server runs in (Vercel runs in UTC, and
 * for half the year midnight there is 1am here).
 */
import type { OrderStatus } from "@/lib/orders";

export const SHOP_TIME_ZONE = "Europe/London";

/* ------------------------------------------------------------------ */
/* Shop-local dates                                                    */
/* ------------------------------------------------------------------ */

/** A day as YYYY-MM-DD, in the shop's time zone. */
export function shopDate(instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SHOP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Minutes the shop's clock is ahead of UTC at `instant` (0 or 60). */
function shopOffsetMinutes(instant: Date): number {
  const name =
    new Intl.DateTimeFormat("en-GB", { timeZone: SHOP_TIME_ZONE, timeZoneName: "shortOffset" })
      .formatToParts(instant)
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return match[1] === "-" ? -minutes : minutes;
}

/** The instant a shop day (YYYY-MM-DD) starts, plus `minutes` into it. */
export function shopDayStart(day: string, minutes = 0): Date {
  const naive = new Date(`${day}T00:00:00Z`).getTime() + minutes * 60_000;
  // The offset at the naive instant is right except within an hour of a
  // clock change, which the second pass corrects.
  const first = naive - shopOffsetMinutes(new Date(naive)) * 60_000;
  return new Date(naive - shopOffsetMinutes(new Date(first)) * 60_000);
}

/** YYYY-MM-DD plus whole days (calendar arithmetic, no time zone involved). */
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday. */
const weekday = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();

/**
 * The next day the courier collects — the next weekday. Bank holidays aren't
 * known here, so the day before one reads a day early rather than late.
 */
export function nextWorkingDay(day: string): string {
  let next = addDays(day, 1);
  while (weekday(next) === 0 || weekday(next) === 6) next = addDays(next, 1);
  return next;
}

/** The Monday a shop week starts on. */
export function weekStart(day: string): string {
  return addDays(day, -((weekday(day) + 6) % 7));
}

export const monthStart = (day: string) => `${day.slice(0, 7)}-01`;

/** "Fri 9 Oct" — a YYYY-MM-DD as the dashboard shows it. */
export function shortDay(day: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

/* ------------------------------------------------------------------ */
/* Cut-off                                                             */
/* ------------------------------------------------------------------ */

/** Minutes after midnight for a cut-off written like "10am", "11:30am" or "2pm". */
export function parseCutoff(text: string): number | null {
  const match = /^\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*$/i.exec(text);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (hour < 1 || hour > 12 || minute > 59) return null;
  const pm = match[3].toLowerCase() === "pm";
  return ((hour % 12) + (pm ? 12 : 0)) * 60 + minute;
}

export type CutoffState =
  | { kind: "open"; minutesLeft: number }
  | { kind: "passed" }
  | { kind: "closed" };

/**
 * Where today stands against the next-day cut-off. A weekend has no
 * cut-off — nothing is collected — so it reads as closed, not passed.
 */
export function cutoffState(now: Date, cutoff: string): CutoffState {
  const today = shopDate(now);
  if (weekday(today) === 0 || weekday(today) === 6) return { kind: "closed" };
  const minutes = parseCutoff(cutoff);
  if (minutes === null) return { kind: "closed" };
  const left = Math.floor((shopDayStart(today, minutes).getTime() - now.getTime()) / 60_000);
  return left > 0 ? { kind: "open", minutesLeft: left } : { kind: "passed" };
}

/** "2h 14m", "45m". */
export function durationText(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`;
}

/* ------------------------------------------------------------------ */
/* Service dates                                                       */
/* ------------------------------------------------------------------ */

export type Urgency = "now" | "soon" | "later" | "none";

/**
 * How the service date reads on the dashboard. "now" is anything that has to
 * leave today — the service is on or before the next working day.
 */
export function serviceUrgency(serviceDate: string | null, today: string): { label: string; urgency: Urgency } {
  if (!serviceDate) return { label: "No service date", urgency: "none" };
  if (serviceDate < today) return { label: `Service was ${shortDay(serviceDate)}`, urgency: "now" };
  if (serviceDate === today) return { label: "Service today", urgency: "now" };
  const tomorrow = addDays(today, 1);
  const label =
    serviceDate === tomorrow
      ? "Service tomorrow"
      : serviceDate < addDays(today, 7)
        ? `Service ${shortDay(serviceDate).split(" ")[0]}`
        : `Service ${shortDay(serviceDate)}`;
  if (serviceDate <= nextWorkingDay(today)) return { label, urgency: "now" };
  if (serviceDate <= nextWorkingDay(nextWorkingDay(today))) return { label, urgency: "soon" };
  return { label, urgency: "later" };
}

/* ------------------------------------------------------------------ */
/* The open work                                                       */
/* ------------------------------------------------------------------ */

/** What the dashboard knows about one paid order, gathered by the server seam. */
export interface DashboardOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  /** The email the customer page is keyed on — the account's when it has one. */
  customerEmail: string | null;
  paidAt: Date | null;
  /** When it moved to shipped, for "sent today". */
  shippedAt: Date | null;
  totalPence: number;
  refundedPence: number;
  thintentJobRef: string | null;
  /** The earliest service date on any line. */
  serviceDate: string | null;
  lines: DashboardLine[];
}

export interface DashboardLine {
  productLabel: string;
  copies: number;
  /** "8 pages", "A2" — the page-count option's label. */
  pagesLabel: string;
  source: "template" | "pdf" | "canva";
  templateName: string | null;
  canvaUrl: string | null;
  /** Upload checks the customer chose to print anyway. */
  acceptedWarnings: string[];
  /** A design line that has no rendered proof (fulfilment's render failed). */
  missingProof: boolean;
}

export const OPEN_STATUSES: readonly OrderStatus[] = ["awaiting_print", "in_production"];

export interface ActionItem {
  orderId: string;
  orderNumber: string;
  customer: string;
  product: string;
  message: string;
  action: string;
  /** Where the action goes; external for a Canva link. */
  href: string;
  external: boolean;
  /** "primary" for the urgent ones, the rest outlined. */
  emphasis: "primary" | "outline";
  chip: { label: string; urgency: Urgency };
}

/** Before then fulfilment is still rendering proofs and sending to Thintent itself. */
const SETTLE_MINUTES = 10;

export function productSummary(lines: readonly Pick<DashboardLine, "productLabel">[]): string {
  const labels = [...new Set(lines.map((line) => line.productLabel))];
  if (labels.length === 0) return "—";
  return labels.length === 1 ? labels[0] : `${labels[0]} + ${labels.length - 1} more`;
}

export const customerName = (order: Pick<DashboardOrder, "contactName" | "contactEmail">) =>
  order.contactName?.trim() || order.contactEmail || "Customer";

/**
 * The things only a person can sort out, most urgent first. Each order gets
 * at most one row — the first rule that applies — so a troubled order doesn't
 * fill the list, and the order page shows the rest.
 */
export function actionItems(
  orders: readonly DashboardOrder[],
  ctx: { now: Date; thintentConfigured: boolean; storageConfigured: boolean },
): ActionItem[] {
  const today = shopDate(ctx.now);
  const settled = (order: DashboardOrder) =>
    order.paidAt !== null && ctx.now.getTime() - order.paidAt.getTime() > SETTLE_MINUTES * 60_000;

  const items: (ActionItem & { rank: number; sortDate: string })[] = [];
  for (const order of orders) {
    const base = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customer: customerName(order),
      product: productSummary(order.lines),
      chip: serviceUrgency(order.serviceDate, today),
      sortDate: order.serviceDate ?? "9999-12-31",
    };
    const orderHref = `/admin/orders/${order.id}`;
    const open = OPEN_STATUSES.includes(order.status);

    if (order.status === "cancelled" && order.paidAt && order.refundedPence < order.totalPence) {
      items.push({
        ...base,
        rank: 1,
        message:
          order.refundedPence > 0
            ? "Cancelled after payment and only part refunded. Refund the rest in Stripe if it’s due."
            : "Cancelled after payment and nothing refunded yet. Refund it in Stripe if it’s due.",
        action: "Refund needed?",
        href: orderHref,
        external: false,
        emphasis: "outline",
        chip: { label: "Cancelled", urgency: "soon" },
      });
      continue;
    }
    if (!open) continue;

    // The file checks matter until it goes to press; once it is printing,
    // someone has already looked.
    const waiting = order.status === "awaiting_print";
    const canva = waiting ? order.lines.find((line) => line.source === "canva" && line.canvaUrl) : undefined;
    const warned = waiting ? order.lines.find((line) => line.acceptedWarnings.length > 0) : undefined;
    const urgent = base.chip.urgency === "now";

    // Fulfilment can only render proofs with storage configured; without it
    // every design line has none, and "regenerate" can't fix that.
    if (ctx.storageConfigured && order.lines.some((line) => line.missingProof) && settled(order)) {
      items.push({
        ...base,
        rank: urgent ? 0 : 2,
        message: "The proof didn’t render after payment. Regenerate it on the order page before it goes to press.",
        action: "Regenerate proof",
        href: orderHref,
        external: false,
        emphasis: urgent ? "primary" : "outline",
      });
    } else if (ctx.thintentConfigured && !order.thintentJobRef && order.status === "awaiting_print" && settled(order)) {
      items.push({
        ...base,
        rank: urgent ? 0 : 2,
        message: "Not in Thintent yet — the automatic send failed. Send it again from the order page.",
        action: "Send to Thintent",
        href: orderHref,
        external: false,
        emphasis: urgent ? "primary" : "outline",
      });
    } else if (canva?.canvaUrl) {
      items.push({
        ...base,
        rank: urgent ? 0 : 2,
        message: "Sent a Canva link. Export it for print and check it — nothing has checked it yet.",
        action: "Open Canva link",
        href: canva.canvaUrl,
        external: true,
        emphasis: urgent ? "primary" : "outline",
      });
    } else if (warned) {
      items.push({
        ...base,
        rank: urgent ? 0 : 3,
        message: `Uploaded PDF printed as it is: ${warned.acceptedWarnings.join("; ")}. Worth a look before press.`,
        action: "Review file",
        href: orderHref,
        external: false,
        emphasis: urgent ? "primary" : "outline",
      });
    } else if (urgent && order.status === "awaiting_print") {
      items.push({
        ...base,
        rank: 0,
        message: "Paid and not printed yet. It has to go out today to make the service.",
        action: "Open order",
        href: orderHref,
        external: false,
        emphasis: "primary",
      });
    } else if (urgent && order.status === "in_production") {
      items.push({
        ...base,
        rank: 1,
        message: "Printing. Mark it sent once it’s with the courier.",
        action: "Open order",
        href: orderHref,
        external: false,
        emphasis: "outline",
      });
    }
  }

  return items
    .sort((a, b) => a.rank - b.rank || a.sortDate.localeCompare(b.sortDate) || a.orderNumber.localeCompare(b.orderNumber))
    .map((item): ActionItem => {
      const { rank, sortDate, ...rest } = item;
      void rank;
      void sortDate;
      return rest;
    });
}

export interface DispatchRow {
  orderId: string;
  orderNumber: string;
  product: string;
  status: OrderStatus;
  sent: boolean;
}

/**
 * Orders that have to leave today to arrive for the service: open ones whose
 * service is on or before the next working day, plus those already sent today.
 * Only lines with a service date can be planned this way.
 */
export function mustGoOutToday(orders: readonly DashboardOrder[], now: Date): DispatchRow[] {
  const today = shopDate(now);
  const deadline = nextWorkingDay(today);
  const rows: DispatchRow[] = [];
  for (const order of orders) {
    if (!order.serviceDate || order.serviceDate < today || order.serviceDate > deadline) continue;
    const sentToday = order.shippedAt !== null && shopDate(order.shippedAt) === today;
    const open = OPEN_STATUSES.includes(order.status);
    if (!open && !(sentToday && order.status === "shipped")) continue;
    rows.push({
      orderId: order.id,
      orderNumber: order.orderNumber,
      product: productSummary(order.lines),
      status: order.status,
      sent: !open,
    });
  }
  return rows.sort((a, b) => Number(a.sent) - Number(b.sent) || a.orderNumber.localeCompare(b.orderNumber));
}

/* ------------------------------------------------------------------ */
/* Takings                                                             */
/* ------------------------------------------------------------------ */

export interface Payment {
  paidAt: Date;
  totalPence: number;
}

export interface Refund {
  refundedAt: Date;
  amountPence: number;
}

export interface Takings {
  orders: number;
  grossPence: number;
  refundedPence: number;
  netPence: number;
}

export interface TakingsSummary {
  today: Takings;
  week: Takings;
  month: Takings;
  /** The same stretch of last month (1st to today's date), for a fair comparison. */
  lastMonthToDate: Takings;
  /** What customers paid per order this month, before refunds; null with no orders. */
  averageOrderPence: number | null;
  /** The last `weeks` shop weeks, oldest first; the last is this week so far. */
  weekly: { weekStart: string; netPence: number; orders: number }[];
}

function sumTakings(payments: readonly Payment[], refunds: readonly Refund[], from: Date, to: Date): Takings {
  const inRange = (date: Date) => date >= from && date < to;
  const paid = payments.filter((payment) => inRange(payment.paidAt));
  const grossPence = paid.reduce((sum, payment) => sum + payment.totalPence, 0);
  const refundedPence = refunds
    .filter((refund) => inRange(refund.refundedAt))
    .reduce((sum, refund) => sum + refund.amountPence, 0);
  return { orders: paid.length, grossPence, refundedPence, netPence: grossPence - refundedPence };
}

/**
 * Money taken, net of refunds, on a cash basis: a payment counts on the day
 * it was made and a refund on the day it was made, which is how the Stripe
 * payouts will read. Prices are VAT-inclusive, so these are too.
 */
export function takingsSummary(
  payments: readonly Payment[],
  refunds: readonly Refund[],
  now: Date,
  weeks = 12,
): TakingsSummary {
  const today = shopDate(now);
  const end = shopDayStart(addDays(today, 1));
  const range = (from: string, to: Date = end) => sumTakings(payments, refunds, shopDayStart(from), to);

  const thisMonth = monthStart(today);
  const lastMonth = monthStart(addDays(thisMonth, -1));
  // 31 Mar compares with the whole of February, not "3 March".
  const dayOfMonth = Number(today.slice(8, 10));
  const lastMonthDays = Number(addDays(thisMonth, -1).slice(8, 10));
  const lastMonthEnd = shopDayStart(addDays(lastMonth, Math.min(dayOfMonth, lastMonthDays)));

  const month = range(thisMonth);
  const thisWeek = weekStart(today);
  const weekly = Array.from({ length: weeks }, (_, index) => {
    const start = addDays(thisWeek, -7 * (weeks - 1 - index));
    const totals = sumTakings(payments, refunds, shopDayStart(start), shopDayStart(addDays(start, 7)));
    return { weekStart: start, netPence: totals.netPence, orders: totals.orders };
  });

  return {
    today: range(today),
    week: range(thisWeek),
    month,
    lastMonthToDate: sumTakings(payments, refunds, shopDayStart(lastMonth), lastMonthEnd),
    averageOrderPence: month.orders > 0 ? Math.round(month.grossPence / month.orders) : null,
    weekly,
  };
}

/** "+12%" / "−8%" against a previous figure; null when there is nothing to compare with. */
export function changeText(current: number, previous: number): string | null {
  if (previous <= 0) return null;
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return "level";
  return change > 0 ? `+${change}%` : `−${Math.abs(change)}%`;
}

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

/** A LIKE pattern that matches `query` anywhere, with its own % and _ taken literally. */
export function likeContains(query: string): string {
  return `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/** The search box's text, trimmed; null when there's nothing to search for. */
export function parseSearch(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, 100);
  return trimmed.length > 0 ? trimmed : null;
}
