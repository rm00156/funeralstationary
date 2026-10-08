/**
 * Gathers the facts behind the admin "Today" page; the rules that turn them
 * into rows and figures are in adminDashboard.ts. Read-only.
 */
import { cache } from "react";
import { and, desc, eq, gte, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  orderEvents,
  orderItems,
  orderProofs,
  orderRefunds,
  orders,
  products,
  templateCategories,
  templates,
  users,
} from "@/db/schema";
import {
  OPEN_STATUSES,
  addDays,
  monthStart,
  shopDate,
  shopDayStart,
  takingsSummary,
  weekStart,
  type DashboardOrder,
  type TakingsSummary,
} from "@/lib/adminDashboard";
import { getProductLabels } from "@/lib/catalogue.server";
import { ORDER_STATUSES, earliestServiceDate, type OrderStatus } from "@/lib/orders";

/** Weeks of takings in the chart. */
export const TAKINGS_WEEKS = 12;
/** How long a cancelled, unrefunded order keeps asking "Refund needed?". */
const REFUND_NAG_DAYS = 30;

export type StatusCounts = Record<OrderStatus, number>;

/**
 * Paid orders per status (drafts — baskets — included for completeness).
 * Cached per request: the layout's badge and the Today page both ask.
 */
export const adminOrderCounts = cache(async (): Promise<StatusCounts> => {
  const rows = await db
    .select({ status: orders.status, count: sql<number>`count(*)` })
    .from(orders)
    .groupBy(orders.status);
  const counts = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as StatusCounts;
  for (const row of rows) counts[row.status] = Number(row.count);
  return counts;
});

/**
 * The orders the day's work is about: everything paid and not yet sent,
 * whatever was sent today, and recent paid cancellations that may still
 * be owed a refund.
 */
export async function loadWorkingOrders(now: Date): Promise<DashboardOrder[]> {
  const todayStart = shopDayStart(shopDate(now));
  const nagFrom = new Date(now.getTime() - REFUND_NAG_DAYS * 86_400_000);

  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      contactName: orders.contactName,
      contactEmail: orders.contactEmail,
      contactPhone: orders.contactPhone,
      paidAt: orders.paidAt,
      totalPence: orders.totalPence,
      thintentJobRef: orders.thintentJobRef,
      accountEmail: users.email,
    })
    .from(orders)
    .leftJoin(users, eq(orders.userId, users.id))
    .where(
      or(
        inArray(orders.status, [...OPEN_STATUSES]),
        and(eq(orders.status, "shipped"), gte(orders.updatedAt, todayStart)),
        and(eq(orders.status, "cancelled"), isNotNull(orders.paidAt), gte(orders.updatedAt, nagFrom)),
      ),
    )
    .orderBy(desc(orders.paidAt));
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);

  const [itemRows, refundRows, shippedRows, labels] = await Promise.all([
    db
      .select({
        id: orderItems.id,
        orderId: orderItems.orderId,
        productId: orderItems.productId,
        templateId: orderItems.templateId,
        designId: orderItems.designId,
        copies: orderItems.quantityCopies,
        quote: orderItems.quoteSnapshot,
        artwork: orderItems.artworkSnapshot,
        serviceDate: orderItems.serviceDate,
      })
      .from(orderItems)
      .where(inArray(orderItems.orderId, ids))
      .orderBy(orderItems.position, orderItems.createdAt),
    db
      .select({ orderId: orderRefunds.orderId, total: sql<number>`sum(${orderRefunds.amountPence})` })
      .from(orderRefunds)
      .where(and(inArray(orderRefunds.orderId, ids), eq(orderRefunds.status, "succeeded")))
      .groupBy(orderRefunds.orderId),
    db
      .select({ orderId: orderEvents.orderId, at: sql<Date>`max(${orderEvents.createdAt})`.mapWith(orders.createdAt) })
      .from(orderEvents)
      .where(
        and(
          inArray(orderEvents.orderId, ids),
          eq(orderEvents.type, "status_changed"),
          eq(orderEvents.toStatus, "shipped"),
        ),
      )
      .groupBy(orderEvents.orderId),
    getProductLabels(),
  ]);

  const designLineIds = itemRows.filter((item) => !item.artwork).map((item) => item.id);
  const templateSlugs = [...new Set(itemRows.map((item) => item.templateId).filter((slug): slug is string => !!slug))];
  const [proofRows, templateRows] = await Promise.all([
    designLineIds.length
      ? db
          .selectDistinct({ itemId: orderProofs.orderItemId })
          .from(orderProofs)
          .where(inArray(orderProofs.orderItemId, designLineIds))
      : [],
    templateSlugs.length
      ? db.select({ slug: templates.slug, name: templates.name }).from(templates).where(inArray(templates.slug, templateSlugs))
      : [],
  ]);
  const proofed = new Set(proofRows.map((row) => row.itemId));
  const templateNames = new Map(templateRows.map((row) => [row.slug, row.name]));
  const refunded = new Map(refundRows.map((row) => [row.orderId, Number(row.total)]));
  const shippedAt = new Map(shippedRows.map((row) => [row.orderId, row.at]));

  return rows.map(({ accountEmail, ...row }): DashboardOrder => {
    const items = itemRows.filter((item) => item.orderId === row.id);
    return {
      ...row,
      customerEmail: accountEmail ?? row.contactEmail,
      shippedAt: shippedAt.get(row.id) ?? null,
      refundedPence: refunded.get(row.id) ?? 0,
      serviceDate: earliestServiceDate(items.map((item) => item.serviceDate)),
      lines: items.map((item) => ({
        productLabel: labels.get(item.productId) ?? item.productId,
        copies: item.copies,
        pagesLabel: item.quote.pages.label,
        source: item.artwork ? item.artwork.source : "template",
        templateName: item.templateId ? (templateNames.get(item.templateId) ?? item.templateId) : null,
        canvaUrl: item.artwork?.source === "canva" ? item.artwork.canvaUrl : null,
        acceptedWarnings:
          item.artwork && item.artwork.warningsAcceptedAt
            ? item.artwork.checks.filter((check) => check.status === "warn").map((check) => check.title)
            : [],
        missingProof: !item.artwork && !!item.designId && !proofed.has(item.id),
      })),
    };
  });
}

/**
 * Payments and succeeded refunds since the start of the earliest period the
 * page shows (the chart's first week, or last month's 1st).
 */
export async function loadTakings(now: Date): Promise<TakingsSummary> {
  const today = shopDate(now);
  const firstWeek = addDays(weekStart(today), -7 * (TAKINGS_WEEKS - 1));
  const lastMonth = monthStart(addDays(monthStart(today), -1));
  const from = shopDayStart(firstWeek < lastMonth ? firstWeek : lastMonth);

  const [payments, refunds] = await Promise.all([
    db
      .select({ paidAt: orders.paidAt, totalPence: orders.totalPence })
      .from(orders)
      .where(and(isNotNull(orders.paidAt), gte(orders.paidAt, from))),
    db
      .select({ refundedAt: orderRefunds.refundedAt, amountPence: orderRefunds.amountPence })
      .from(orderRefunds)
      .where(and(eq(orderRefunds.status, "succeeded"), gte(orderRefunds.refundedAt, from))),
  ]);
  return takingsSummary(
    payments.flatMap((payment) => (payment.paidAt ? [{ paidAt: payment.paidAt, totalPence: payment.totalPence }] : [])),
    refunds,
    now,
    TAKINGS_WEEKS,
  );
}

export interface ProductSales {
  label: string;
  orders: number;
  copies: number;
  /** Print cost plus the line's delivery, VAT-inclusive. */
  pence: number;
}

/** What sold this month, best first. */
export async function loadProductSales(now: Date): Promise<ProductSales[]> {
  const from = shopDayStart(monthStart(shopDate(now)));
  const [rows, labels] = await Promise.all([
    db
      .select({
        productId: orderItems.productId,
        orders: sql<number>`count(distinct ${orderItems.orderId})`,
        copies: sql<number>`sum(${orderItems.quantityCopies})`,
        pence: sql<number>`sum(${orderItems.lineTotalPence} + coalesce(${orderItems.deliveryPricePence}, 0))`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(isNotNull(orders.paidAt), gte(orders.paidAt, from)))
      .groupBy(orderItems.productId),
    getProductLabels(),
  ]);
  return rows
    .map((row) => ({
      label: labels.get(row.productId) ?? row.productId,
      orders: Number(row.orders),
      copies: Number(row.copies),
      pence: Number(row.pence),
    }))
    .sort((a, b) => b.pence - a.pence);
}

export interface CatalogueCounts {
  products: number;
  templates: number;
  draftTemplates: number;
  categories: number;
}

export async function loadCatalogueCounts(): Promise<CatalogueCounts> {
  const [productRows, templateRows, categoryRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(products).where(eq(products.isActive, true)),
    db
      .select({ status: templates.status, count: sql<number>`count(*)` })
      .from(templates)
      .where(ne(templates.status, "archived"))
      .groupBy(templates.status),
    db.select({ count: sql<number>`count(*)` }).from(templateCategories).where(eq(templateCategories.isActive, true)),
  ]);
  const byStatus = new Map(templateRows.map((row) => [row.status, Number(row.count)]));
  return {
    products: Number(productRows[0]?.count ?? 0),
    templates: byStatus.get("published") ?? 0,
    draftTemplates: byStatus.get("draft") ?? 0,
    categories: Number(categoryRows[0]?.count ?? 0),
  };
}
