/**
 * How /account presents orders: which one leads the page, how far along it
 * is, and the wording for it. Pure and unit-tested; the page gathers the
 * orders with listOrders (orders.server.ts).
 *
 * There is no proof step anywhere here on purpose: a design is checked before
 * it can be paid for (designReadiness.ts), so a paid order goes straight to
 * print and the customer has nothing to approve.
 */
import { SHOP_TIME_ZONE, shopDate } from "@/lib/adminDashboard";
import { copiesText } from "@/lib/orderOfServicePricing";
import type { OrderStatus } from "@/lib/orders";

/** The tracker under the lead order. */
export const ORDER_PROGRESS_STEPS = ["Ordered", "Printing", "On its way", "Delivered"] as const;

/** How many of the steps are done or under way, 0-based; null when the order left the track. */
export function orderProgressStep(status: OrderStatus): number | null {
  switch (status) {
    case "awaiting_print":
      return 0;
    case "in_production":
      return 1;
    case "shipped":
      return 2;
    case "delivered":
      return 3;
    default:
      return null;
  }
}

/**
 * One tracker step's state. "Ordered" is done the moment it's paid, the step
 * the order is on is current, and a delivered order is done throughout.
 */
export function progressState(index: number, status: OrderStatus): "done" | "current" | "todo" {
  const step = orderProgressStep(status);
  if (step === null) return index === 0 ? "done" : "todo";
  if (index < step || index === 0 || status === "delivered") return "done";
  return index === step ? "current" : "todo";
}

const OPEN: ReadonlySet<OrderStatus> = new Set(["awaiting_print", "in_production", "shipped"]);

export const isOpenOrder = (status: OrderStatus) => OPEN.has(status);

/**
 * The order the page leads with — the newest one still on its way — and
 * everything else, in the order given (newest first). No open order, no lead.
 */
export function splitLeadOrder<T extends { status: OrderStatus }>(
  orders: readonly T[],
): { lead: T | null; rest: T[] } {
  const lead = orders.find((order) => isOpenOrder(order.status)) ?? null;
  return { lead, rest: orders.filter((order) => order !== lead) };
}

/** The lead card's eyebrow, heading and sentence. */
export function orderHeadline(status: OrderStatus): { label: string; title: string; body: string } {
  switch (status) {
    case "in_production":
      return {
        label: "Printing",
        title: "Your order is being printed",
        body: "We’re printing it now, exactly as you designed it.",
      };
    case "shipped":
      return {
        label: "On its way",
        title: "Your order is on its way",
        body: "It has left us and is with the courier.",
      };
    case "delivered":
      return { label: "Delivered", title: "Your order has been delivered", body: "We hope it was right for the day." };
    case "cancelled":
      return { label: "Cancelled", title: "This order was cancelled", body: "It won’t be printed." };
    case "refunded":
      return { label: "Refunded", title: "This order was refunded", body: "The money has gone back to your card." };
    default:
      return {
        label: "Ordered",
        title: "We’ve got your order",
        body: "It’s paid for and waiting to go to print, exactly as you designed it.",
      };
  }
}

/** "Bookmarks ×100, Memorial Cards ×50" — every line, for the trade table. */
export function itemsSummary(lines: readonly { productLabel: string; copies: number }[]): string {
  return lines.map((line) => `${line.productLabel} ×${line.copies}`).join(", ");
}

/** "Bookmarks · 50 copies", or "Bookmarks and 1 more" — a family's one-line title. */
export function orderTitle(lines: readonly { productLabel: string; copies: number }[]): string {
  const [first, ...others] = lines;
  if (!first) return "Your order";
  if (others.length === 0) return `${first.productLabel} · ${copiesText(first.copies)}`;
  return `${first.productLabel} and ${others.length} more`;
}

const dayMs = 24 * 60 * 60 * 1000;

/** Whole shop days between two instants, counting calendar days in Europe/London. */
function shopDaysBetween(from: Date, to: Date): number {
  const start = Date.parse(`${shopDate(from)}T00:00:00Z`);
  const end = Date.parse(`${shopDate(to)}T00:00:00Z`);
  return Math.round((end - start) / dayMs);
}

/** "today", "yesterday", "3 days ago", else "on 9 October". */
export function changedWhen(instant: Date, now: Date): string {
  const days = shopDaysBetween(instant, now);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return `on ${shortDate(instant)}`;
}

/** "9 October", in the shop's zone. */
export function shortDate(instant: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: SHOP_TIME_ZONE, day: "numeric", month: "long" }).format(
    instant,
  );
}

/** A yyyy-mm-dd service date as "Friday 16 October" (or "Wed 14 Oct" when short). */
export function serviceDateText(iso: string, style: "long" | "short" = "long"): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: style,
    day: "numeric",
    month: style,
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}
