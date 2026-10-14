/**
 * The admin Analytics pages' rules — the period, the takings split, how late
 * an order was, what "gone quiet" means for a trade account, working hours,
 * the copies and pages people choose. Pure and unit-tested (same discipline
 * as adminDashboard.ts); adminAnalytics.server.ts gathers the facts.
 *
 * Every figure is worked out from the shop's own records. Nothing here is
 * estimated or sampled: a question the records can't answer (a page view, a
 * proof approval, a reprint) is left off the page rather than guessed at.
 */
import type { ArtworkCheck } from "@/lib/artwork";
import {
  addDays,
  monthStart,
  parseCutoff,
  shopDate,
  shopDayStart,
  SHOP_TIME_ZONE,
  weekStart,
} from "@/lib/adminDashboard";
import type { OrderStatus } from "@/lib/orders";

/* ------------------------------------------------------------------ */
/* The period                                                          */
/* ------------------------------------------------------------------ */

export const PERIOD_KEYS = ["4w", "12w", "12m"] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];
export const DEFAULT_PERIOD: PeriodKey = "12w";

export const PERIOD_LABELS: Record<PeriodKey, { short: string; long: string }> = {
  "4w": { short: "4 weeks", long: "last 4 weeks" },
  "12w": { short: "12 weeks", long: "last 12 weeks" },
  "12m": { short: "12 months", long: "last 12 months" },
};

export function parsePeriod(value: unknown): PeriodKey {
  return typeof value === "string" && (PERIOD_KEYS as readonly string[]).includes(value)
    ? (value as PeriodKey)
    : DEFAULT_PERIOD;
}

export interface Bucket {
  /** First shop day, YYYY-MM-DD. */
  start: string;
  /** The day after the last, YYYY-MM-DD. */
  end: string;
  /** "21 Jul" for a week, "Jul" for a month. */
  label: string;
  /** "Week of 21 Jul", "July 2026" — for a tooltip or table. */
  longLabel: string;
}

export interface Period {
  key: PeriodKey;
  /** First shop day of the period. */
  from: string;
  /** The day after today — the period runs up to now. */
  to: string;
  /** The same number of days just before `from`, for "vs previous". */
  previousFrom: string;
  /** Weeks (4w, 12w) or months (12m), oldest first; the last is still running. */
  buckets: Bucket[];
}

/** YYYY-MM-01 moved by whole months. */
export function addMonths(day: string, months: number): string {
  const [year, month] = day.split("-").map(Number);
  const index = year * 12 + (month - 1) + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}-01`;
}

const dayCount = (from: string, to: string) =>
  Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);

const utcFormat = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" });
const dayMonth = utcFormat({ day: "numeric", month: "short" });
const monthName = utcFormat({ month: "short" });
const monthYear = utcFormat({ month: "long", year: "numeric" });
const asDate = (day: string) => new Date(`${day}T00:00:00Z`);

/**
 * Whole weeks (Monday to Sunday) or whole months, ending with the one
 * running now, so a bar always means the same stretch of the calendar.
 */
export function analyticsPeriod(key: PeriodKey, now: Date): Period {
  const today = shopDate(now);
  const to = addDays(today, 1);
  let buckets: Bucket[];
  if (key === "12m") {
    const first = addMonths(monthStart(today), -11);
    buckets = Array.from({ length: 12 }, (_, index) => {
      const start = addMonths(first, index);
      return {
        start,
        end: addMonths(start, 1),
        label: monthName.format(asDate(start)),
        longLabel: monthYear.format(asDate(start)),
      };
    });
  } else {
    const weeks = key === "4w" ? 4 : 12;
    const first = addDays(weekStart(today), -7 * (weeks - 1));
    buckets = Array.from({ length: weeks }, (_, index) => {
      const start = addDays(first, 7 * index);
      return {
        start,
        end: addDays(start, 7),
        label: dayMonth.format(asDate(start)),
        longLabel: `Week of ${dayMonth.format(asDate(start))}`,
      };
    });
  }
  const from = buckets[0].start;
  return { key, from, to, previousFrom: addDays(from, -dayCount(from, to)), buckets };
}

/** "21 July – 12 October 2026" (the year once when both ends share it). */
export function periodText(period: Pick<Period, "from" | "to">): string {
  const first = asDate(period.from);
  const last = asDate(addDays(period.to, -1));
  const long = utcFormat({ day: "numeric", month: "long" });
  const year = (date: Date) => date.getUTCFullYear();
  return year(first) === year(last)
    ? `${long.format(first)} – ${long.format(last)} ${year(last)}`
    : `${long.format(first)} ${year(first)} – ${long.format(last)} ${year(last)}`;
}

/** Whether an instant falls on a shop day in [from, to). */
export function withinDays(instant: Date | null, from: string, to: string): boolean {
  if (!instant) return false;
  const day = shopDate(instant);
  return day >= from && day < to;
}

/* ------------------------------------------------------------------ */
/* The facts                                                           */
/* ------------------------------------------------------------------ */

export type DesignSource = "template" | "pdf" | "canva";

export interface AnalyticsLine {
  productSlug: string;
  copies: number;
  /** The page-count option's label as ordered: "8 pages", "A2". */
  pagesLabel: string;
  /** Its page count, for ordering the labels. */
  pageCount: number;
  source: DesignSource;
  templateSlug: string | null;
  designId: string | null;
  /** The upload checks that warned and the customer printed anyway. */
  uploadWarnings: ArtworkCheck["id"][];
}

/** A placed order (paid by card, or placed on account) as the analytics read it. */
export interface AnalyticsOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  placedAt: Date;
  /** Null on an account order until its invoice is paid. */
  paidAt: Date | null;
  totalPence: number;
  tradeFirmId: number | null;
  /** The customer's email, lowercased: the account's, else the one typed at checkout. */
  customer: string | null;
  /** The earliest service date on any line. */
  serviceDate: string | null;
  /** When it first moved to in_production, shipped and delivered. */
  pressAt: Date | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  lines: AnalyticsLine[];
}

export interface AnalyticsRefund {
  refundedAt: Date;
  amountPence: number;
  tradeFirmId: number | null;
}

/** Everything placed, back to the first order: enough to know who is new and how often a firm orders. */
export interface HistoryOrder {
  id: string;
  placedAt: Date;
  customer: string | null;
  tradeFirmId: number | null;
}

export interface ProductInfo {
  slug: string;
  label: string;
  /** A three-page template: cover, repeating middle, back. */
  booklet: boolean;
}

const isTrade = (row: { tradeFirmId: number | null }) => row.tradeFirmId !== null;

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** A whole-number percentage, or null with nothing to divide by. */
export function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

/** "98.7%" — one decimal place, for a figure near 100 where whole numbers hide the misses. */
export function percentText(part: number, whole: number, decimals = 0): string {
  if (whole <= 0) return "—";
  const value = (part / whole) * 100;
  return `${decimals ? value.toFixed(decimals).replace(/\.0+$/, "") : Math.round(value)}%`;
}

/* ------------------------------------------------------------------ */
/* Takings                                                             */
/* ------------------------------------------------------------------ */

export interface TakingsSplit {
  familiesPence: number;
  tradePence: number;
  /** Payments (not refunds) — orders paid in the stretch. */
  payments: number;
}

/**
 * Net takings on a cash basis, as the Today page counts them: a payment on
 * the day it was paid, a refund on the day it was made, VAT-inclusive.
 */
export function takingsBetween(
  orders: readonly Pick<AnalyticsOrder, "paidAt" | "totalPence" | "tradeFirmId">[],
  refunds: readonly AnalyticsRefund[],
  from: string,
  to: string,
): TakingsSplit {
  const split: TakingsSplit = { familiesPence: 0, tradePence: 0, payments: 0 };
  for (const order of orders) {
    if (!withinDays(order.paidAt, from, to)) continue;
    split.payments += 1;
    if (isTrade(order)) split.tradePence += order.totalPence;
    else split.familiesPence += order.totalPence;
  }
  for (const refund of refunds) {
    if (!withinDays(refund.refundedAt, from, to)) continue;
    if (isTrade(refund)) split.tradePence -= refund.amountPence;
    else split.familiesPence -= refund.amountPence;
  }
  return split;
}

export const totalOf = (split: TakingsSplit) => split.familiesPence + split.tradePence;

/** Gross payments alone, for an average order that refunds don't drag down. */
function grossBetween(orders: readonly Pick<AnalyticsOrder, "paidAt" | "totalPence">[], from: string, to: string) {
  const paid = orders.filter((order) => withinDays(order.paidAt, from, to));
  return { count: paid.length, pence: paid.reduce((sum, order) => sum + order.totalPence, 0) };
}

export interface Comparison {
  current: number;
  previous: number;
}

export interface OverviewHeadlines {
  takings: Comparison;
  orders: Comparison;
  /** Per payment, before refunds; null with nothing paid. */
  averageOrder: { current: number | null; previous: number | null };
}

export function overviewHeadlines(
  orders: readonly AnalyticsOrder[],
  refunds: readonly AnalyticsRefund[],
  period: Period,
): OverviewHeadlines {
  const placed = (from: string, to: string) => orders.filter((order) => withinDays(order.placedAt, from, to)).length;
  const average = (from: string, to: string) => {
    const gross = grossBetween(orders, from, to);
    return gross.count > 0 ? Math.round(gross.pence / gross.count) : null;
  };
  return {
    takings: {
      current: totalOf(takingsBetween(orders, refunds, period.from, period.to)),
      previous: totalOf(takingsBetween(orders, refunds, period.previousFrom, period.from)),
    },
    orders: { current: placed(period.from, period.to), previous: placed(period.previousFrom, period.from) },
    averageOrder: { current: average(period.from, period.to), previous: average(period.previousFrom, period.from) },
  };
}

export interface TakingsBucket extends Bucket, TakingsSplit {}

export function takingsByBucket(
  orders: readonly AnalyticsOrder[],
  refunds: readonly AnalyticsRefund[],
  period: Period,
): TakingsBucket[] {
  return period.buckets.map((bucket) => ({ ...bucket, ...takingsBetween(orders, refunds, bucket.start, bucket.end) }));
}

/* ------------------------------------------------------------------ */
/* Keeping the promise                                                 */
/* ------------------------------------------------------------------ */

export interface LateOrder {
  id: string;
  orderNumber: string;
  productSlugs: string[];
  copies: number;
  serviceDate: string;
  placedAt: Date;
  /** Null when it never went out. */
  sentAt: Date | null;
}

export interface Timeliness {
  /** Orders whose service fell in the period and has happened. */
  total: number;
  inTime: number;
  late: LateOrder[];
}

const COUNTED_FOR_TIMELINESS: readonly OrderStatus[] = ["awaiting_print", "in_production", "shipped", "delivered"];

/**
 * A refunded order reached `refunded` either from delivered (it went out —
 * and a late one is the likeliest to be refunded) or from cancelled (it
 * never did). Only a sent order tells the two apart.
 */
const cancelledBeforeSending = (order: Pick<AnalyticsOrder, "status" | "sentAt">) =>
  order.status === "cancelled" || (order.status === "refunded" && order.sentAt === null);

/**
 * Did it leave in time for the service? An order is in time when it was sent
 * on a day before the service — next-day delivery is what is sold, so sent
 * the day before is the latest that makes it. Only orders that gave a
 * service date can be judged, only services that have happened count (one
 * next week hasn't had its chance yet), and an order cancelled before it was
 * sent isn't late — one refunded after it went out still is.
 * Sent is the shop's own record; when the courier delivered isn't known
 * reliably, so it isn't what is judged.
 */
export function serviceTimeliness(orders: readonly AnalyticsOrder[], period: Period, now: Date): Timeliness {
  const today = shopDate(now);
  const result: Timeliness = { total: 0, inTime: 0, late: [] };
  for (const order of orders) {
    const service = order.serviceDate;
    if (!service || service < period.from || service >= period.to || service > today) continue;
    const counted =
      COUNTED_FOR_TIMELINESS.includes(order.status) || (order.status === "refunded" && order.sentAt !== null);
    if (!counted) continue;
    result.total += 1;
    if (order.sentAt && shopDate(order.sentAt) < service) {
      result.inTime += 1;
      continue;
    }
    result.late.push({
      id: order.id,
      orderNumber: order.orderNumber,
      productSlugs: [...new Set(order.lines.map((line) => line.productSlug))],
      copies: order.lines.reduce((sum, line) => sum + line.copies, 0),
      serviceDate: service,
      placedAt: order.placedAt,
      sentAt: order.sentAt,
    });
  }
  result.late.sort((a, b) => b.serviceDate.localeCompare(a.serviceDate));
  return result;
}

/**
 * Why a late order was late, as far as the records tell: placed too close to
 * the service to make it, or with time to spare (so the delay was ours or
 * the courier's — which one isn't recorded).
 */
export function lateReason(order: Pick<LateOrder, "placedAt" | "serviceDate" | "sentAt">, cutoff: string): string {
  // Next-day delivery: to be sent on the working day before the service it
  // had to be in by that day's cut-off.
  const latest = shopDayStart(previousWorkingDay(order.serviceDate), parseCutoff(cutoff) ?? 0);
  if (order.placedAt >= latest) return "Ordered too close to the service";
  return order.sentAt ? "Sent late" : "Not sent";
}

function previousWorkingDay(day: string): string {
  let previous = addDays(day, -1);
  while ([0, 6].includes(asDate(previous).getUTCDay())) previous = addDays(previous, -1);
  return previous;
}

/* ------------------------------------------------------------------ */
/* What sells                                                          */
/* ------------------------------------------------------------------ */

export interface CountRow {
  key: string;
  count: number;
  /** Of the whole the card is about, 0–100; null with nothing to share. */
  share: number | null;
}

const placedIn = (orders: readonly AnalyticsOrder[], period: Pick<Period, "from" | "to">) =>
  orders.filter((order) => withinDays(order.placedAt, period.from, period.to));

/** Orders containing each product, most first. */
export function ordersByProduct(orders: readonly AnalyticsOrder[], period: Period): CountRow[] {
  const placed = placedIn(orders, period);
  const counts = new Map<string, number>();
  for (const order of placed) {
    for (const slug of new Set(order.lines.map((line) => line.productSlug))) {
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([key, count]) => ({ key, count, share: percent(count, placed.length) }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export const SOURCE_LABELS: Record<DesignSource, string> = {
  template: "Designed on the site",
  pdf: "PDF upload",
  canva: "Canva link",
};

/** Order lines by where the artwork came from, in a fixed order. */
export function designSources(orders: readonly AnalyticsOrder[], period: Period): CountRow[] {
  const lines = placedIn(orders, period).flatMap((order) => order.lines);
  return (["template", "pdf", "canva"] as const).map((source) => {
    const count = lines.filter((line) => line.source === source).length;
    return { key: source, count, share: percent(count, lines.length) };
  });
}

/** Templates by the orders that printed them, most first. */
export function topTemplates(orders: readonly AnalyticsOrder[], period: Period, limit = 5): CountRow[] {
  const counts = new Map<string, number>();
  let total = 0;
  for (const order of placedIn(orders, period)) {
    for (const slug of new Set(order.lines.map((line) => line.templateSlug).filter((slug): slug is string => !!slug))) {
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
      total += 1;
    }
  }
  return [...counts]
    .map(([key, count]) => ({ key, count, share: percent(count, total) }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit);
}

export interface FunnelStep {
  label: string;
  count: number;
  /** Share of the step before that reached this one; null on the first. */
  continued: number | null;
}

export function funnelSteps(steps: readonly { label: string; count: number }[]): FunnelStep[] {
  return steps.map((step, index) => ({
    ...step,
    continued: index === 0 ? null : percent(step.count, steps[index - 1].count),
  }));
}

/* ------------------------------------------------------------------ */
/* Trade accounts                                                      */
/* ------------------------------------------------------------------ */

export interface TradeFirmInfo {
  id: number;
  name: string;
  createdAt: Date;
  isActive: boolean;
  /** From the application it was approved from; null for a firm set up by hand. */
  phone: string | null;
}

export type TradeTrend = "new" | "growing" | "steady" | "slowing" | "quiet" | "none";

export const TRADE_TREND_LABELS: Record<TradeTrend, string> = {
  new: "New",
  growing: "Growing",
  steady: "Steady",
  slowing: "Slowing",
  quiet: "Gone quiet",
  none: "No orders",
};

export interface TradeAccountRow {
  firm: TradeFirmInfo;
  takingsPence: number;
  orders: number;
  /** Net takings per bucket of the period. */
  buckets: number[];
  lastOrderAt: Date | null;
  /** Days since the last order, in shop days. */
  daysSinceLast: number | null;
  /** The firm's usual gap between orders; null until it has three. */
  usualGapDays: number | null;
  trend: TradeTrend;
  /** Takings in the 12 weeks up to its last order — what went quiet. */
  takingsBeforePence: number;
}

/** A firm has gone quiet when it's been this many of its usual gaps since it ordered… */
export const QUIET_GAP_MULTIPLE = 2.5;
/** …and at least this long, so a weekly orderer isn't flagged after a fortnight's holiday. */
export const QUIET_MIN_DAYS = 28;
const QUIET_LOOKBACK_DAYS = 84;
/** A half of the period this much busier than the other is a trend. */
const TREND_RATIO = 1.25;

const daysBetween = (earlier: Date, later: Date) => dayCount(shopDate(earlier), shopDate(later));

/** The median gap between a firm's orders, in days; null under three orders. */
export function usualGapDays(placedAts: readonly Date[]): number | null {
  if (placedAts.length < 3) return null;
  const sorted = [...placedAts].sort((a, b) => a.getTime() - b.getTime());
  const gaps = sorted.slice(1).map((date, index) => daysBetween(sorted[index], date));
  return Math.max(1, Math.round(median(gaps) ?? 1));
}

export function isQuiet(daysSinceLast: number | null, usualGap: number | null): boolean {
  if (daysSinceLast === null || usualGap === null) return false;
  return daysSinceLast >= Math.max(QUIET_GAP_MULTIPLE * usualGap, QUIET_MIN_DAYS);
}

/**
 * A firm's trend over the period: gone quiet (judged on its whole history),
 * new (its account opened during the period), else the later half of the
 * period's complete weeks (or months) against the earlier half.
 */
export function tradeTrend(input: {
  quiet: boolean;
  createdAt: Date;
  period: Period;
  buckets: readonly number[];
  orders: number;
}): TradeTrend {
  if (input.quiet) return "quiet";
  if (withinDays(input.createdAt, input.period.from, input.period.to)) return "new";
  if (input.orders === 0) return "none";
  // The last bucket is still running, so it would always make the recent
  // half look quieter; leave it out, and the oldest too when that evens the halves.
  const complete = input.buckets.slice(0, -1);
  const even = complete.slice(complete.length % 2);
  const half = even.length / 2;
  const first = even.slice(0, half).reduce((sum, value) => sum + value, 0);
  const second = even.slice(half).reduce((sum, value) => sum + value, 0);
  if (first <= 0) return second > 0 ? "growing" : "steady";
  if (second >= first * TREND_RATIO) return "growing";
  if (second * TREND_RATIO <= first) return "slowing";
  return "steady";
}

export function tradeAccountRows(input: {
  firms: readonly TradeFirmInfo[];
  orders: readonly AnalyticsOrder[];
  refunds: readonly AnalyticsRefund[];
  history: readonly HistoryOrder[];
  period: Period;
  now: Date;
}): TradeAccountRow[] {
  const { firms, orders, refunds, history, period, now } = input;
  return firms.map((firm) => {
    const own = orders.filter((order) => order.tradeFirmId === firm.id);
    const ownRefunds = refunds.filter((refund) => refund.tradeFirmId === firm.id);
    const net = (from: string, to: string) => totalOf(takingsBetween(own, ownRefunds, from, to));
    const placedAts = history.filter((order) => order.tradeFirmId === firm.id).map((order) => order.placedAt);
    const lastOrderAt = placedAts.reduce<Date | null>((latest, date) => (!latest || date > latest ? date : latest), null);
    const daysSinceLast = lastOrderAt ? daysBetween(lastOrderAt, now) : null;
    const usualGap = usualGapDays(placedAts);
    const buckets = period.buckets.map((bucket) => net(bucket.start, bucket.end));
    const orderCount = own.filter((order) => withinDays(order.placedAt, period.from, period.to)).length;
    const quiet = firm.isActive && isQuiet(daysSinceLast, usualGap);
    const lastDay = lastOrderAt ? shopDate(lastOrderAt) : null;
    return {
      firm,
      takingsPence: net(period.from, period.to),
      orders: orderCount,
      buckets,
      lastOrderAt,
      daysSinceLast,
      usualGapDays: usualGap,
      trend: tradeTrend({ quiet, createdAt: firm.createdAt, period, buckets, orders: orderCount }),
      takingsBeforePence: lastDay ? net(addDays(lastDay, -QUIET_LOOKBACK_DAYS), addDays(lastDay, 1)) : 0,
    };
  });
}

export const TRADE_SORTS = ["takings", "last-order", "name"] as const;
export type TradeSort = (typeof TRADE_SORTS)[number];

export function parseTradeSort(value: unknown): TradeSort {
  return typeof value === "string" && (TRADE_SORTS as readonly string[]).includes(value)
    ? (value as TradeSort)
    : "takings";
}

export function sortTradeRows(rows: readonly TradeAccountRow[], sort: TradeSort): TradeAccountRow[] {
  const byName = (a: TradeAccountRow, b: TradeAccountRow) => a.firm.name.localeCompare(b.firm.name);
  return [...rows].sort((a, b) => {
    if (sort === "name") return byName(a, b);
    if (sort === "last-order") {
      return (b.lastOrderAt?.getTime() ?? 0) - (a.lastOrderAt?.getTime() ?? 0) || byName(a, b);
    }
    return b.takingsPence - a.takingsPence || b.orders - a.orders || byName(a, b);
  });
}

/** "Today", "Yesterday", "3 days ago", then the date. */
export function lastOrderText(days: number | null, lastOrderAt: Date | null): string {
  if (days === null || !lastOrderAt) return "Never";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: SHOP_TIME_ZONE }).format(
    lastOrderAt,
  );
}

/* ------------------------------------------------------------------ */
/* Production & timings                                                */
/* ------------------------------------------------------------------ */

export interface WorkingHours {
  /** Minutes after midnight, shop time, Monday to Friday. */
  start: number;
  end: number;
}

const DEFAULT_HOURS: WorkingHours = { start: 9 * 60, end: 18 * 60 };

/** "Mon–Fri 9am–6pm" → 9:00–18:00; the default when it can't be read. */
export function parseWorkingHours(text: string): WorkingHours {
  const match = /(\d{1,2}(?::\d{2})?\s*[ap]m)\s*[–-]\s*(\d{1,2}(?::\d{2})?\s*[ap]m)/i.exec(text);
  const start = match ? parseCutoff(match[1]) : null;
  const end = match ? parseCutoff(match[2]) : null;
  return start !== null && end !== null && end > start ? { start, end } : DEFAULT_HOURS;
}

/**
 * Minutes of working time between two instants: weekdays within opening
 * hours, in shop time. An order placed on Friday evening and sent on Monday
 * at 10 took an hour of the shop's time, not sixty.
 */
export function workingMinutes(from: Date, to: Date, hours: WorkingHours): number {
  if (to <= from) return 0;
  let total = 0;
  for (let day = shopDate(from); day <= shopDate(to); day = addDays(day, 1)) {
    if ([0, 6].includes(asDate(day).getUTCDay())) continue;
    const open = Math.max(shopDayStart(day, hours.start).getTime(), from.getTime());
    const close = Math.min(shopDayStart(day, hours.end).getTime(), to.getTime());
    if (close > open) total += (close - open) / 60_000;
  }
  return Math.round(total);
}

export interface StageTime {
  label: string;
  /** Median working minutes; null when no order has done this step yet. */
  minutes: number | null;
  orders: number;
}

/**
 * The median working time each step takes, over orders placed in the period
 * that have reached it. A step's times come from the status changes Thintent
 * (or an admin) made, so it is as accurate as those were kept.
 */
export function stageTimes(orders: readonly AnalyticsOrder[], period: Period, hours: WorkingHours): StageTime[] {
  const placed = placedIn(orders, period);
  const stage = (label: string, from: (order: AnalyticsOrder) => Date | null, to: (order: AnalyticsOrder) => Date | null) => {
    const times = placed.flatMap((order) => {
      const start = from(order);
      const end = to(order);
      return start && end && end >= start ? [workingMinutes(start, end, hours)] : [];
    });
    return { label, minutes: median(times), orders: times.length };
  };
  return [
    stage("Order placed → sent to press", (order) => order.placedAt, (order) => order.pressAt),
    stage("Sent to press → with the courier", (order) => order.pressAt, (order) => order.sentAt),
    stage("With the courier → delivered", (order) => order.sentAt, (order) => order.deliveredAt),
  ];
}

/** Placed → with the courier, median working minutes. */
export function orderToDispatch(orders: readonly AnalyticsOrder[], period: Period, hours: WorkingHours): StageTime {
  const times = placedIn(orders, period).flatMap((order) =>
    order.sentAt && order.sentAt >= order.placedAt ? [workingMinutes(order.placedAt, order.sentAt, hours)] : [],
  );
  return { label: "Order to dispatch", minutes: median(times), orders: times.length };
}

/** The shop's weekday (0 = Monday) and minutes after midnight for an instant. */
export function shopClock(instant: Date): { weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SHOP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    weekday: (asDate(shopDate(instant)).getUTCDay() + 6) % 7,
    minutes: get("hour") * 60 + get("minute"),
  };
}

/** Orders placed after the cut-off on a weekday, or at the weekend — none can go out that day. */
export function afterCutoff(orders: readonly AnalyticsOrder[], period: Period, cutoff: string) {
  const placed = placedIn(orders, period);
  const cutoffMinutes = parseCutoff(cutoff);
  const late = placed.filter((order) => {
    const clock = shopClock(order.placedAt);
    return clock.weekday >= 5 || (cutoffMinutes !== null && clock.minutes >= cutoffMinutes);
  }).length;
  return { count: late, total: placed.length };
}

/** Orders placed per weekday (Monday first) and hour, shop time. */
export function orderHeatmap(orders: readonly AnalyticsOrder[], period: Period): number[][] {
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const order of placedIn(orders, period)) {
    const clock = shopClock(order.placedAt);
    grid[clock.weekday][Math.floor(clock.minutes / 60)] += 1;
  }
  return grid;
}

/** 0–4: how dark a heatmap cell is, against the busiest cell. */
export function heatLevel(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4)));
}

/** "11am", "12pm", "6pm" for an hour of the day. */
export function hourText(hour: number): string {
  const suffix = hour < 12 ? "am" : "pm";
  return `${hour % 12 === 0 ? 12 : hour % 12}${suffix}`;
}

/* ------------------------------------------------------------------ */
/* Products & customers                                                */
/* ------------------------------------------------------------------ */

export interface BookletStats {
  /** Booklet lines in the period. */
  lines: number;
  medianCopies: number | null;
  averageCopies: number | null;
  /** Lines by copies, fewest copies first. */
  copies: { copies: number; count: number }[];
  /** Lines by page-count option, fewest pages first. */
  pages: CountRow[];
  /** Orders with a booklet in them. */
  orders: number;
  /** Of those, how many also had something else. */
  withMore: number;
  /** Of those, each other product's share. */
  addOns: CountRow[];
}

/** The booklets families bought: how many copies, how many pages, what came with them. */
export function bookletStats(
  orders: readonly AnalyticsOrder[],
  period: Period,
  products: ReadonlyMap<string, ProductInfo>,
): BookletStats {
  const booklet = (slug: string) => products.get(slug)?.booklet ?? false;
  const withBooklet = placedIn(orders, period).filter((order) => order.lines.some((line) => booklet(line.productSlug)));
  const lines = withBooklet.flatMap((order) => order.lines.filter((line) => booklet(line.productSlug)));

  const copyCounts = new Map<number, number>();
  for (const line of lines) copyCounts.set(line.copies, (copyCounts.get(line.copies) ?? 0) + 1);

  const pageCounts = new Map<string, { count: number; pageCount: number }>();
  for (const line of lines) {
    const entry = pageCounts.get(line.pagesLabel) ?? { count: 0, pageCount: line.pageCount };
    entry.count += 1;
    pageCounts.set(line.pagesLabel, entry);
  }

  const addOnCounts = new Map<string, number>();
  let withMore = 0;
  for (const order of withBooklet) {
    const others = new Set(order.lines.filter((line) => !booklet(line.productSlug)).map((line) => line.productSlug));
    if (others.size > 0) withMore += 1;
    for (const slug of others) addOnCounts.set(slug, (addOnCounts.get(slug) ?? 0) + 1);
  }

  const copies = lines.map((line) => line.copies);
  return {
    lines: lines.length,
    medianCopies: median(copies),
    averageCopies: copies.length ? Math.round(copies.reduce((sum, value) => sum + value, 0) / copies.length) : null,
    copies: [...copyCounts].map(([value, count]) => ({ copies: value, count })).sort((a, b) => a.copies - b.copies),
    pages: [...pageCounts]
      .sort((a, b) => a[1].pageCount - b[1].pageCount || a[0].localeCompare(b[0]))
      .map(([key, { count }]) => ({ key, count, share: percent(count, lines.length) })),
    orders: withBooklet.length,
    withMore,
    addOns: [...addOnCounts]
      .map(([key, count]) => ({ key, count, share: percent(count, withBooklet.length) }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)),
  };
}

/** How long after a first order another counts as "ordering again". */
export const REPEAT_WINDOW_DAYS = 60;
/** A next order of the same design, whatever the product. */
export const SAME_DESIGN = "same-design";

export interface RepeatStats {
  /** Families whose first order was in the period. */
  firstTimers: number;
  /** Of those, how many ordered again within the window. */
  repeaters: number;
  /** What the next order held: SAME_DESIGN, or a product slug. */
  next: { key: string; families: number; share: number | null; medianDays: number | null }[];
}

/**
 * Families who came back. A family is a customer email; its first order is
 * its first ever (from `history`), and only first orders in the period are
 * followed. Its next order within the window is classed as the same design
 * again — more copies — or by each product it held.
 */
export function repeatStats(
  orders: readonly AnalyticsOrder[],
  history: readonly HistoryOrder[],
  period: Period,
): RepeatStats {
  const byCustomer = new Map<string, HistoryOrder[]>();
  for (const order of history) {
    if (!order.customer || isTrade(order)) continue;
    const list = byCustomer.get(order.customer) ?? [];
    list.push(order);
    byCustomer.set(order.customer, list);
  }
  const detail = new Map(orders.map((order) => [order.id, order]));

  let firstTimers = 0;
  let repeaters = 0;
  const next = new Map<string, number[]>();
  for (const list of byCustomer.values()) {
    list.sort((a, b) => a.placedAt.getTime() - b.placedAt.getTime());
    const [first, second] = list;
    if (!withinDays(first.placedAt, period.from, period.to)) continue;
    firstTimers += 1;
    if (!second) continue;
    const days = daysBetween(first.placedAt, second.placedAt);
    if (days > REPEAT_WINDOW_DAYS) continue;
    repeaters += 1;

    const firstLines = detail.get(first.id)?.lines ?? [];
    const secondLines = detail.get(second.id)?.lines ?? [];
    const designs = new Set(firstLines.map((line) => line.designId).filter(Boolean));
    const keys = new Set<string>();
    for (const line of secondLines) {
      keys.add(line.designId && designs.has(line.designId) ? SAME_DESIGN : line.productSlug);
    }
    for (const key of keys) next.set(key, [...(next.get(key) ?? []), days]);
  }

  return {
    firstTimers,
    repeaters,
    next: [...next]
      .map(([key, days]) => ({
        key,
        families: days.length,
        share: percent(days.length, firstTimers),
        medianDays: median(days),
      }))
      .sort((a, b) => b.families - a.families || a.key.localeCompare(b.key)),
  };
}

/** Distinct families (customer emails) who placed an order in the period. */
export function familiesWhoOrdered(orders: readonly AnalyticsOrder[], period: Period): number {
  return new Set(placedIn(orders, period).flatMap((order) => (order.customer ? [order.customer] : []))).size;
}

export const UPLOAD_WARNING_LABELS: Partial<Record<ArtworkCheck["id"], string>> = {
  photos: "Photos may print soft",
  bleed: "No bleed",
  size: "Scaled to fit",
  fonts: "Fonts not embedded",
  pages: "One page for a two-sided card",
  content: "Couldn’t check every page",
};

/**
 * Uploaded PDFs that were ordered, by the warnings the customer accepted to
 * print anyway. A file the check blocked never reaches an order, so it
 * isn't counted here — these are the near-misses.
 */
export function uploadWarnings(orders: readonly AnalyticsOrder[], period: Period) {
  const uploads = placedIn(orders, period).flatMap((order) => order.lines.filter((line) => line.source === "pdf"));
  const counts = new Map<string, number>();
  for (const line of uploads) {
    for (const id of new Set(line.uploadWarnings)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const clean = uploads.filter((line) => line.uploadWarnings.length === 0).length;
  return {
    uploads: uploads.length,
    clean,
    rows: [...counts]
      .map(([key, count]) => ({ key, count, share: percent(count, uploads.length) }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)),
  };
}

/* ------------------------------------------------------------------ */
/* For the pages                                                       */
/* ------------------------------------------------------------------ */

/** The top of a chart's scale: the next 1, 2 or 5 × a power of ten at or above `max`. */
export function niceCeiling(max: number): number {
  if (max <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(max));
  return ([1, 2, 5, 10].find((step) => step * power >= max) ?? 10) * power;
}

/** Orders placed in the period that were cancelled before they were sent (refunded or not). */
export function cancelledCount(orders: readonly AnalyticsOrder[], period: Period): number {
  return placedIn(orders, period).filter(cancelledBeforeSending).length;
}

/** The step most people stop at, as "from → to"; null with fewer than two steps or nobody started. */
export function biggestDrop(steps: readonly FunnelStep[]): { from: string; to: string } | null {
  let worst: { from: string; to: string; continued: number } | null = null;
  for (let index = 1; index < steps.length; index += 1) {
    const continued = steps[index].continued;
    if (continued === null) continue;
    if (!worst || continued < worst.continued) {
      worst = { from: steps[index - 1].label, to: steps[index].label, continued };
    }
  }
  return worst && worst.continued < 100 ? { from: worst.from, to: worst.to } : null;
}

/** The firms to call: active ones gone quiet, the most takings lost first. */
export function quietAccounts(rows: readonly TradeAccountRow[]): TradeAccountRow[] {
  return rows.filter((row) => row.trend === "quiet").sort((a, b) => b.takingsBeforePence - a.takingsBeforePence);
}

/** The accounts table: every active firm, and a retired one only while it has orders in the period. */
export function listedAccounts(rows: readonly TradeAccountRow[], sort: TradeSort): TradeAccountRow[] {
  return sortTradeRows(
    rows.filter((row) => row.firm.isActive || row.orders > 0),
    sort,
  );
}

/** The step that takes longest, of those any order has reached. */
export function longestStage(stages: readonly StageTime[]): StageTime | null {
  return (
    stages
      .filter((stage) => stage.minutes !== null)
      .sort((a, b) => (b.minutes ?? 0) - (a.minutes ?? 0))[0] ?? null
  );
}

/** "3 sent late · 1 ordered too close to the service", most common first. */
export function reasonSummary(reasons: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const reason of reasons) counts.set(reason, (counts.get(reason) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([reason, count]) => `${count} ${reason.toLowerCase()}`);
}
