/**
 * Gathers the facts behind the admin Analytics pages; the rules that turn
 * them into figures are in adminAnalytics.ts. Read-only.
 *
 * The order book is small, so placed orders are read whole (less their
 * design documents) for the period and two years before it, and every rule
 * runs in memory — the same choice /admin/customers makes.
 */
import { and, asc, eq, gte, inArray, isNotNull, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  artworkUploads,
  designs,
  orderEvents,
  orderItems,
  orderRefunds,
  orders,
  products,
  templateCategories,
  templateCategoryLinks,
  templates,
  tradeApplications,
  tradeFirms,
  users,
} from "@/db/schema";
import { addDays, shopDayStart } from "@/lib/adminDashboard";
import type {
  AnalyticsOrder,
  AnalyticsRefund,
  HistoryOrder,
  Period,
  ProductInfo,
  TradeFirmInfo,
} from "@/lib/adminAnalytics";
import { customerKey } from "@/lib/adminCustomers";

/** How far before the period orders are read: enough to know a family's first order and a firm's rhythm. */
const HISTORY_DAYS = 730;

export interface AnalyticsFacts {
  orders: AnalyticsOrder[];
  history: HistoryOrder[];
  refunds: AnalyticsRefund[];
}

export async function loadAnalyticsFacts(period: Period): Promise<AnalyticsFacts> {
  const historyFrom = shopDayStart(addDays(period.previousFrom, -HISTORY_DAYS));
  const previousFrom = shopDayStart(period.previousFrom);
  // Placed in the window, or paid in it (an account order's invoice can be paid long after).
  const inWindow = and(
    isNotNull(orders.placedAt),
    ne(orders.status, "draft"),
    or(gte(orders.placedAt, historyFrom), gte(orders.paidAt, previousFrom)),
  );

  const [orderRows, itemRows, eventRows, refundRows] = await Promise.all([
    db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        placedAt: orders.placedAt,
        paidAt: orders.paidAt,
        totalPence: orders.totalPence,
        tradeFirmId: orders.tradeFirmId,
        contactEmail: orders.contactEmail,
        accountEmail: users.email,
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .where(inWindow),
    db
      .select({
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
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(inWindow)
      .orderBy(asc(orderItems.position), asc(orderItems.createdAt)),
    db
      .select({
        orderId: orderEvents.orderId,
        toStatus: orderEvents.toStatus,
        at: sql<Date>`min(${orderEvents.createdAt})`.mapWith(orderEvents.createdAt),
      })
      .from(orderEvents)
      .innerJoin(orders, eq(orderEvents.orderId, orders.id))
      .where(
        and(
          inWindow,
          eq(orderEvents.type, "status_changed"),
          inArray(orderEvents.toStatus, ["in_production", "shipped", "delivered"]),
        ),
      )
      .groupBy(orderEvents.orderId, orderEvents.toStatus),
    db
      .select({
        refundedAt: orderRefunds.refundedAt,
        amountPence: orderRefunds.amountPence,
        tradeFirmId: orders.tradeFirmId,
      })
      .from(orderRefunds)
      .innerJoin(orders, eq(orderRefunds.orderId, orders.id))
      // As far back as the orders: a quiet firm's takings before its last order can predate the period.
      .where(and(eq(orderRefunds.status, "succeeded"), gte(orderRefunds.refundedAt, historyFrom))),
  ]);

  const itemsByOrder = new Map<string, typeof itemRows>();
  for (const item of itemRows) itemsByOrder.set(item.orderId, [...(itemsByOrder.get(item.orderId) ?? []), item]);
  const eventAt = new Map(eventRows.map((row) => [`${row.orderId}:${row.toStatus}`, row.at]));

  const analyticsOrders = orderRows.flatMap((row): AnalyticsOrder[] => {
    if (!row.placedAt) return [];
    const items = itemsByOrder.get(row.id) ?? [];
    const email = row.accountEmail ?? row.contactEmail;
    const serviceDates = items.map((item) => item.serviceDate).filter((date): date is string => !!date).sort();
    return [
      {
        id: row.id,
        orderNumber: row.orderNumber,
        status: row.status,
        placedAt: row.placedAt,
        paidAt: row.paidAt,
        totalPence: row.totalPence,
        tradeFirmId: row.tradeFirmId,
        customer: email ? customerKey(email) : null,
        serviceDate: serviceDates[0] ?? null,
        pressAt: eventAt.get(`${row.id}:in_production`) ?? null,
        sentAt: eventAt.get(`${row.id}:shipped`) ?? null,
        deliveredAt: eventAt.get(`${row.id}:delivered`) ?? null,
        lines: items.map((item) => ({
          productSlug: item.productId,
          copies: item.copies,
          pagesLabel: item.quote.pages.label,
          pageCount: item.quote.pages.pages,
          source: item.artwork ? item.artwork.source : "template",
          templateSlug: item.templateId,
          designId: item.designId,
          uploadWarnings:
            item.artwork?.warningsAcceptedAt
              ? item.artwork.checks.filter((check) => check.status === "warn").map((check) => check.id)
              : [],
        })),
      },
    ];
  });

  return {
    orders: analyticsOrders,
    history: analyticsOrders.map(({ id, placedAt, customer, tradeFirmId }) => ({ id, placedAt, customer, tradeFirmId })),
    refunds: refundRows,
  };
}

export async function loadProductInfo(): Promise<Map<string, ProductInfo>> {
  const rows = await db
    .select({ slug: products.slug, label: products.label, templatePages: products.templatePages })
    .from(products)
    .orderBy(asc(products.sortOrder), asc(products.label));
  return new Map(rows.map((row) => [row.slug, { slug: row.slug, label: row.label, booklet: row.templatePages === 3 }]));
}

/** Every firm, with the phone number from the application it was approved from (if any). */
export async function loadTradeFirms(): Promise<TradeFirmInfo[]> {
  const [firms, phones] = await Promise.all([
    db
      .select({ id: tradeFirms.id, name: tradeFirms.name, createdAt: tradeFirms.createdAt, isActive: tradeFirms.isActive })
      .from(tradeFirms),
    db
      .select({ firmId: tradeApplications.firmId, phone: tradeApplications.phone })
      .from(tradeApplications)
      .where(and(eq(tradeApplications.status, "approved"), isNotNull(tradeApplications.firmId)))
      .orderBy(asc(tradeApplications.decidedAt)),
  ]);
  // The latest approval wins.
  const phoneByFirm = new Map(phones.map((row) => [row.firmId, row.phone]));
  return firms.map((firm) => ({ ...firm, phone: phoneByFirm.get(firm.id) ?? null }));
}

export interface DesignFunnel {
  /** Designs and uploads started in the period. */
  started: number;
  /** Of those, ones that have been put in a basket (and are still there, or were ordered). */
  inBasket: number;
  /** Of those, ones on a placed order. */
  ordered: number;
}

/**
 * What became of the designs and uploads started in the period. A basket
 * line that was removed is gone, so "in a basket" counts what is still in
 * one or was ordered — it can only undercount, never invent.
 */
export async function loadDesignFunnel(period: Period): Promise<DesignFunnel> {
  const from = shopDayStart(period.from);
  const to = shopDayStart(period.to);
  // Correlated on the outer table's id: a line for this design, then one on
  // a placed order. Spelled out with aliases — in a select list Drizzle
  // leaves columns unqualified, and a bare `id` would resolve to the
  // subquery's own table.
  const counts = (owner: "designs" | "artwork_uploads", column: "design_id" | "upload_id") => {
    const line = sql.raw(`oi.${column} = ${owner}.id`);
    return {
      started: sql<number>`count(*)`,
      inBasket: sql<number>`coalesce(sum(exists(select 1 from ${orderItems} oi where ${line})), 0)`,
      ordered: sql<number>`coalesce(sum(exists(select 1 from ${orderItems} oi inner join ${orders} o on o.id = oi.order_id where ${line} and o.placed_at is not null)), 0)`,
    };
  };

  const [designRow, uploadRow] = await Promise.all([
    db
      .select(counts("designs", "design_id"))
      .from(designs)
      .where(and(gte(designs.createdAt, from), lt(designs.createdAt, to))),
    db
      .select(counts("artwork_uploads", "upload_id"))
      .from(artworkUploads)
      .where(and(gte(artworkUploads.createdAt, from), lt(artworkUploads.createdAt, to))),
  ]);
  const sum = (key: keyof DesignFunnel) => Number(designRow[0]?.[key] ?? 0) + Number(uploadRow[0]?.[key] ?? 0);
  return { started: sum("started"), inBasket: sum("inBasket"), ordered: sum("ordered") };
}

export interface TemplateMeta {
  name: string;
  /** Its first category's label. */
  category: string | null;
}

/** Every template's name and first category — a small table, so read whole alongside the orders. */
export async function loadTemplateMeta(): Promise<Map<string, TemplateMeta>> {
  const rows = await db
    .select({ slug: templates.slug, name: templates.name, category: templateCategories.label })
    .from(templates)
    .leftJoin(templateCategoryLinks, eq(templateCategoryLinks.templateId, templates.id))
    .leftJoin(templateCategories, eq(templateCategories.id, templateCategoryLinks.categoryId))
    .orderBy(asc(templateCategoryLinks.position));
  const meta = new Map<string, TemplateMeta>();
  for (const row of rows) if (!meta.has(row.slug)) meta.set(row.slug, { name: row.name, category: row.category });
  return meta;
}

export async function countPublishedTemplates(): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)` }).from(templates).where(eq(templates.status, "published"));
  return Number(row?.count ?? 0);
}
