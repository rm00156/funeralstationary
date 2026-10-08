/**
 * Admin reads for customers (see adminCustomers.ts for what a customer is).
 * Read-only: nothing here edits a customer — their details are snapshots on
 * their orders, and an account is theirs.
 */
import { and, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { artworkUploads, designs, orderItems, orderRefunds, orders, users } from "@/db/schema";
import {
  customerKey,
  groupCustomers,
  matchesCustomer,
  type CustomerSummary,
} from "@/lib/adminCustomers";
import { getProductLabels } from "@/lib/catalogue.server";
import { refundedPence, type OrderStatus } from "@/lib/orders";

const orderColumns = {
  id: orders.id,
  orderNumber: orders.orderNumber,
  userId: orders.userId,
  contactName: orders.contactName,
  contactEmail: orders.contactEmail,
  contactPhone: orders.contactPhone,
  postcode: orders.postcode,
  totalPence: orders.totalPence,
  placedAt: orders.placedAt,
  createdAt: orders.createdAt,
};

/** How many rows the customers page lists before asking for a search. */
export const CUSTOMER_LIST_LIMIT = 200;

/**
 * Every customer, or those matching `query`. Grouped in memory: a customer
 * is an email across guest orders and an account, which no single query
 * can key on — and a funeral stationer's order book stays small enough.
 */
export async function adminListCustomers(
  query: string | null,
): Promise<{ customers: CustomerSummary[]; total: number }> {
  const [orderRows, accounts] = await Promise.all([
    db.select(orderColumns).from(orders).where(ne(orders.status, "draft")),
    db.select({ id: users.id, email: users.email, name: users.name, createdAt: users.createdAt }).from(users),
  ]);
  const all = groupCustomers(orderRows, accounts);
  const matched = query ? all.filter((customer) => matchesCustomer(customer, query)) : all;
  return { customers: matched.slice(0, CUSTOMER_LIST_LIMIT), total: matched.length };
}

export interface CustomerOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  placedAt: Date | null;
  totalPence: number;
  refundedPence: number;
  products: string[];
  itemCount: number;
  serviceDate: string | null;
}

export interface CustomerDetail {
  summary: CustomerSummary;
  address: { line1: string | null; line2: string | null; city: string | null; postcode: string | null } | null;
  orders: CustomerOrder[];
  refundedPence: number;
  savedDesigns: number;
  uploads: number;
}

/** One customer by email, or null when no paid order or account carries it. */
export async function adminGetCustomer(rawEmail: string): Promise<CustomerDetail | null> {
  const email = customerKey(rawEmail);
  if (!email.includes("@")) return null;

  const [account] = await db
    .select({ id: users.id, email: users.email, name: users.name, createdAt: users.createdAt })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email))
    .limit(1);

  const byEmail = eq(sql`lower(${orders.contactEmail})`, email);
  const orderRows = await db
    .select({
      ...orderColumns,
      status: orders.status,
      addressLine1: orders.addressLine1,
      addressLine2: orders.addressLine2,
      city: orders.city,
    })
    .from(orders)
    .where(and(ne(orders.status, "draft"), account ? or(byEmail, eq(orders.userId, account.id)) : byEmail))
    .orderBy(desc(orders.placedAt), desc(orders.createdAt));

  // An order typed with this email but placed on someone else's account
  // belongs to that account's customer, as on the list.
  const mine = orderRows.filter((row) => !row.userId || row.userId === account?.id);

  const [summary] = groupCustomers(mine, account ? [account] : []).filter((row) => row.email === email);
  if (!summary) return null;

  const ids = mine.map((row) => row.id);
  const [itemRows, refundRows, labels, designCount, uploadCount] = await Promise.all([
    ids.length
      ? db
          .select({ orderId: orderItems.orderId, productId: orderItems.productId, serviceDate: orderItems.serviceDate })
          .from(orderItems)
          .where(inArray(orderItems.orderId, ids))
      : [],
    ids.length
      ? db
          .select({ orderId: orderRefunds.orderId, amountPence: orderRefunds.amountPence, status: orderRefunds.status })
          .from(orderRefunds)
          .where(inArray(orderRefunds.orderId, ids))
      : [],
    getProductLabels(),
    account
      ? db
          .select({ count: sql<number>`count(*)` })
          .from(designs)
          .where(and(eq(designs.userId, account.id), isNull(designs.deletedAt)))
      : [{ count: 0 }],
    account
      ? db.select({ count: sql<number>`count(*)` }).from(artworkUploads).where(eq(artworkUploads.userId, account.id))
      : [{ count: 0 }],
  ]);

  const customerOrders = mine.map((row): CustomerOrder => {
    const items = itemRows.filter((item) => item.orderId === row.id);
    const dates = items.map((item) => item.serviceDate).filter((date): date is string => !!date).sort();
    return {
      id: row.id,
      orderNumber: row.orderNumber,
      status: row.status,
      placedAt: row.placedAt,
      totalPence: row.totalPence,
      refundedPence: refundedPence(refundRows.filter((refund) => refund.orderId === row.id)),
      products: [...new Set(items.map((item) => labels.get(item.productId) ?? item.productId))],
      itemCount: items.length,
      serviceDate: dates[0] ?? null,
    };
  });

  const latest = mine[0];
  return {
    summary,
    address: latest
      ? { line1: latest.addressLine1, line2: latest.addressLine2, city: latest.city, postcode: latest.postcode }
      : null,
    orders: customerOrders,
    refundedPence: customerOrders.reduce((sum, order) => sum + order.refundedPence, 0),
    savedDesigns: Number(designCount[0]?.count ?? 0),
    uploads: Number(uploadCount[0]?.count ?? 0),
  };
}

/** The email an order's customer page is keyed on (see orderCustomerEmail). */
export async function adminOrderCustomerEmail(orderId: string): Promise<string | null> {
  const [row] = await db
    .select({ contactEmail: orders.contactEmail, accountEmail: users.email })
    .from(orders)
    .leftJoin(users, eq(orders.userId, users.id))
    .where(eq(orders.id, orderId))
    .limit(1);
  const email = row?.accountEmail ?? row?.contactEmail;
  return email ? customerKey(email) : null;
}
