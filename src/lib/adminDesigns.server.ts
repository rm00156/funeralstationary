/**
 * Admin access to customers' designs — finding one, and editing it on the
 * customer's behalf when they're stuck. Every route that reaches this module
 * checks isAdmin first. Edits land on the customer's own design (it is
 * theirs, and they'll see the change next time they open it) through
 * designs.server.ts's adminWriteDesign, guarded by the same revision check as
 * their own saves.
 */
import { and, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { designs, orderItems, orders, products, templates, users } from "@/db/schema";
import { likeContains } from "@/lib/adminDashboard";
import { designOrderState, designOwner, type DesignOrderState } from "@/lib/adminDesigns";
import { adminFindDesign, type SavedDesign } from "@/lib/designs.server";
import type { Owner } from "@/lib/session";

/** How many designs the list shows before asking for a search. */
export const ADMIN_DESIGN_LIST_LIMIT = 50;

export interface DesignOwner {
  email: string;
  name: string | null;
}

export interface AdminDesignRow {
  id: string;
  name: string;
  productLabel: string;
  templateName: string;
  updatedAt: Date;
  /** The account it belongs to; null for a guest's design. */
  owner: DesignOwner | null;
  orderState: DesignOrderState;
}

async function orderStates(ids: string[]): Promise<Map<string, DesignOrderState>> {
  const lines = ids.length
    ? await db
        .select({
          designId: orderItems.designId,
          orderId: orders.id,
          orderNumber: orders.orderNumber,
          status: orders.status,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(inArray(orderItems.designId, ids))
    : [];
  return new Map(
    ids.map((id) => [id, designOrderState(lines.filter((line) => line.designId === id))]),
  );
}

/**
 * Live designs, newest first: those matching `query` (the design's name, the
 * account's email, or the wording on it — so a guest's design is found by the
 * name of the person it's for), or those belonging to one customer.
 */
export async function adminListDesigns(
  filter: { query: string | null } | { customer: { userId: string | null; email: string } },
): Promise<AdminDesignRow[]> {
  let match;
  if ("query" in filter) {
    if (filter.query) {
      const pattern = likeContains(filter.query.toLowerCase());
      match = or(
        sql`lower(${designs.name}) like ${pattern}`,
        sql`lower(${users.email}) like ${pattern}`,
        // The wording only: every text element's text, not the doc's keys,
        // image URLs or font names, so "rose" doesn't find every design on a
        // rose background. A scan of every design, which the order book's
        // size allows.
        sql`lower(cast(json_extract(${designs.doc}, '$.pages[*].elements[*].text') as char)) like ${pattern}`,
      );
    }
  } else {
    // A customer's designs: their account's, and — for a guest, who has no
    // account to scope by — the designs on the paid orders made in their
    // name. Not everything else made in that browser: a shared computer (a
    // funeral director's office) would list other families' designs.
    const { userId, email } = filter.customer;
    const onTheirOrders = db
      .select({ designId: orderItems.designId })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(
        and(
          eq(sql`lower(${orders.contactEmail})`, email),
          isNull(orders.userId),
          ne(orders.status, "draft"),
        ),
      );
    match = or(
      userId ? eq(designs.userId, userId) : undefined,
      inArray(designs.id, onTheirOrders),
    );
    if (!match) return [];
  }

  const rows = await db
    .select({
      id: designs.id,
      name: designs.name,
      updatedAt: designs.updatedAt,
      productLabel: products.label,
      templateName: templates.name,
      ownerEmail: users.email,
      ownerName: users.name,
    })
    .from(designs)
    .innerJoin(products, eq(designs.productId, products.id))
    .innerJoin(templates, eq(designs.templateId, templates.id))
    .leftJoin(users, eq(designs.userId, users.id))
    .where(and(isNull(designs.deletedAt), match))
    .orderBy(desc(designs.updatedAt))
    .limit(ADMIN_DESIGN_LIST_LIMIT);

  const states = await orderStates(rows.map((row) => row.id));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    productLabel: row.productLabel,
    templateName: row.templateName,
    updatedAt: row.updatedAt,
    owner: row.ownerEmail ? { email: row.ownerEmail, name: row.ownerName } : null,
    orderState: states.get(row.id) ?? designOrderState([]),
  }));
}

/**
 * Who owns a live design — for a photo an admin uploads into it, which is
 * filed under the design's owner, not the admin's own browser.
 */
export async function adminDesignOwner(id: string): Promise<Owner | null> {
  const [row] = await db
    .select({ userId: designs.userId, guestToken: designs.guestToken })
    .from(designs)
    .where(and(eq(designs.id, id), isNull(designs.deletedAt)))
    .limit(1);
  return row ? designOwner(row) : null;
}

/** Whether a live design with this id exists — for jumping straight to a pasted link. */
export async function adminDesignExists(id: string): Promise<boolean> {
  const [row] = await db
    .select({ id: designs.id })
    .from(designs)
    .where(and(eq(designs.id, id), isNull(designs.deletedAt)))
    .limit(1);
  return !!row;
}

export interface AdminDesignDetail {
  design: SavedDesign;
  owner: DesignOwner | null;
  orderState: DesignOrderState;
}

/** Any customer's live design, with who owns it and where it stands with orders. */
export async function adminGetDesign(id: string): Promise<AdminDesignDetail | null> {
  const design = await adminFindDesign(id);
  if (!design) return null;
  const [[owner], states] = await Promise.all([
    db
      .select({ email: users.email, name: users.name })
      .from(designs)
      .innerJoin(users, eq(designs.userId, users.id))
      .where(eq(designs.id, id))
      .limit(1),
    orderStates([id]),
  ]);
  return {
    design,
    owner: owner ?? null,
    orderState: states.get(id) ?? designOrderState([]),
  };
}
