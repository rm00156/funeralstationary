/**
 * Admin reads/writes for orders — the admin counterpart of orders.server.ts.
 * Unscoped by owner (the admin sees everything), never touches money or
 * snapshots (those are history), and drives status through the pure
 * transition table so an order can't skip steps.
 */
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
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
}

/** Placed orders, newest first. Drafts (baskets) only when asked for by status. */
export async function adminListOrders(filter: { status?: OrderStatus } = {}): Promise<AdminOrderSummary[]> {
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
    })
    .from(orders)
    .where(filter.status ? eq(orders.status, filter.status) : ne(orders.status, "draft"))
    .orderBy(desc(orders.placedAt), desc(orders.createdAt));
  if (rows.length === 0) return [];

  const items = await db
    .select({ orderId: orderItems.orderId })
    .from(orderItems)
    .where(inArray(orderItems.orderId, rows.map((row) => row.id)));
  const countByOrder = new Map<string, number>();
  for (const item of items) {
    countByOrder.set(item.orderId, (countByOrder.get(item.orderId) ?? 0) + 1);
  }
  return rows.map((row) => ({ ...row, itemCount: countByOrder.get(row.id) ?? 0 }));
}

export async function adminCountOrders(status: OrderStatus): Promise<number> {
  const rows = await db.select({ id: orders.id }).from(orders).where(eq(orders.status, status));
  return rows.length;
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
  if (!canTransition(current.status, to)) {
    throw new OrderTransitionError(
      `An order that is "${current.status}" cannot be moved to "${to}"`,
    );
  }

  const [result] = await db
    .update(orders)
    .set({ status: to })
    .where(and(eq(orders.id, id), eq(orders.status, current.status)));
  if (result.affectedRows === 0) {
    throw new OrderTransitionError("This order was changed by someone else — reload and try again");
  }

  await addOrderEvent(id, {
    type: "status_changed",
    fromStatus: current.status,
    toStatus: to,
    note,
    actor,
  });

  return loadOrderDetail(id);
}
