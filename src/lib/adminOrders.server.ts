/**
 * Admin reads/writes for orders — the admin counterpart of orders.server.ts.
 * Unscoped by owner (the admin sees everything), never touches money or
 * snapshots (those are history), and drives status through the pure
 * transition table so an order can't skip steps.
 */
import { and, desc, eq, inArray, like, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, users } from "@/db/schema";
import { likeContains } from "@/lib/adminDashboard";
import { getProductLabels } from "@/lib/catalogue.server";
import { canTransition, type OrderStatus } from "@/lib/orders";
import { addOrderEvent, loadOrderDetail, type OrderDetail } from "@/lib/orders.server";

/** An illegal status move — the route answers 409. */
export class OrderTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderTransitionError";
  }
}

export interface AdminOrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  placedAt: Date | null;
  createdAt: Date;
  contactName: string | null;
  contactEmail: string | null;
  totalPence: number;
  itemCount: number;
  /** Product labels on the order, in line order without repeats. */
  products: string[];
  /** The email its customer page is keyed on — the account's when it has one. */
  customerEmail: string | null;
}

/** How many orders the list shows; a search narrows it down. */
export const ORDER_LIST_LIMIT = 200;

/**
 * What the orders search box looks in: the order number, the customer's
 * name, email, phone and postcode, the Thintent job, and the email of the
 * account it was placed on.
 */
function orderSearch(query: string): SQL {
  const pattern = likeContains(query);
  const conditions = [
    like(orders.orderNumber, pattern),
    like(orders.contactName, pattern),
    like(orders.contactEmail, pattern),
    like(orders.postcode, pattern),
    like(orders.thintentJobRef, pattern),
    like(users.email, pattern),
  ];
  // Phone numbers are stored as typed: "07700 900123" should match "07700900123".
  const phoneDigits = query.replace(/\D/g, "");
  if (phoneDigits.length >= 4) {
    conditions.push(like(sql`replace(replace(${orders.contactPhone}, ' ', ''), '-', '')`, likeContains(phoneDigits)));
  }
  // A postcode typed without its space ("BR31QZ").
  conditions.push(like(sql`replace(${orders.postcode}, ' ', '')`, likeContains(query.replace(/\s+/g, ""))));
  return or(...conditions)!;
}

/**
 * Placed orders, newest first. Drafts (baskets) only when asked for by
 * status. `query` searches across every status unless one is chosen.
 */
export async function adminListOrders(
  filter: { status?: OrderStatus; query?: string | null } = {},
): Promise<AdminOrderSummary[]> {
  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      placedAt: orders.placedAt,
      createdAt: orders.createdAt,
      contactName: orders.contactName,
      contactEmail: orders.contactEmail,
      totalPence: orders.totalPence,
      accountEmail: users.email,
    })
    .from(orders)
    .leftJoin(users, eq(orders.userId, users.id))
    .where(
      and(
        filter.status ? eq(orders.status, filter.status) : ne(orders.status, "draft"),
        filter.query ? orderSearch(filter.query) : undefined,
      ),
    )
    .orderBy(desc(orders.placedAt), desc(orders.createdAt))
    .limit(ORDER_LIST_LIMIT);
  if (rows.length === 0) return [];

  const [items, labels] = await Promise.all([
    db
      .select({ orderId: orderItems.orderId, productId: orderItems.productId })
      .from(orderItems)
      .where(inArray(orderItems.orderId, rows.map((row) => row.id)))
      .orderBy(orderItems.position, orderItems.createdAt),
    getProductLabels(),
  ]);
  const itemsByOrder = new Map<string, string[]>();
  for (const item of items) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push(labels.get(item.productId) ?? item.productId);
    itemsByOrder.set(item.orderId, list);
  }
  return rows.map(({ accountEmail, ...row }) => {
    const products = itemsByOrder.get(row.id) ?? [];
    return {
      ...row,
      itemCount: products.length,
      products: [...new Set(products)],
      customerEmail: accountEmail ?? row.contactEmail,
    };
  });
}

export async function adminGetOrder(id: string): Promise<OrderDetail | null> {
  return loadOrderDetail(id);
}

/**
 * Move an order along the status machine, recording who and why. The
 * update is conditional on the status the admin was looking at, so two
 * admins acting on a stale screen can't both "win".
 */
export async function adminUpdateOrderStatus(
  id: string,
  to: OrderStatus,
  note: string | null,
  actor = "admin",
): Promise<OrderDetail | null> {
  const current = await loadOrderDetail(id);
  if (!current) return null;
  // Once it has a job, Thintent is where status changes — a move here would
  // never reach it, and the two would disagree from then on. The override
  // stays for an order that never got there.
  if (current.thintent) {
    throw new OrderTransitionError(
      `This order is managed in Thintent as job #${current.thintent.jobRef} — move the job there and this order follows`,
    );
  }
  if (!canTransition(current.status, to)) {
    throw new OrderTransitionError(
      `An order that is "${current.status}" cannot be moved to "${to}"`,
    );
  }

  if (!(await moveOrderStatus(id, current.status, to, note, actor))) {
    throw new OrderTransitionError("This order was changed by someone else — reload and try again");
  }

  return loadOrderDetail(id);
}

/**
 * One status move, conditional on the order still being `from`, with its
 * `status_changed` event. False when the order had already moved on — the
 * caller decides whether that is a conflict (an admin on a stale screen) or
 * harmless (a redelivered Thintent webhook). Callers check canTransition.
 */
export async function moveOrderStatus(
  id: string,
  from: OrderStatus,
  to: OrderStatus,
  note: string | null,
  actor: string,
): Promise<boolean> {
  const [result] = await db
    .update(orders)
    .set({ status: to })
    .where(and(eq(orders.id, id), eq(orders.status, from)));
  if (result.affectedRows === 0) return false;

  await addOrderEvent(id, { type: "status_changed", fromStatus: from, toStatus: to, note, actor });
  return true;
}
