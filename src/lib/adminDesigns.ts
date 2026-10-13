/**
 * Admins editing a customer's design on their behalf — the pure rules.
 * adminDesigns.server.ts is the seam.
 */
import type { Owner } from "@/lib/session";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * The design a pasted reference names: the link the customer copied from
 * their editor (`…/design?design=<id>&quantity=…`), an admin link, or the bare
 * id. Null for anything else — a name or an email is a search, not a reference.
 */
export function designReference(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const match = raw.trim().match(UUID);
  return match ? match[0].toLowerCase() : null;
}

export const adminDesignHref = (id: string) => `/admin/designs/${id}`;

export interface DesignOrderLine {
  orderId: string;
  orderNumber: string;
  status: string;
}

export interface DesignOrderState {
  /** In the customer's basket — edits show there, and are what they'll pay for. */
  inBasket: boolean;
  /**
   * Orders already paid for. Each printed from the copy frozen at its pay
   * click, so editing the design now changes none of them.
   */
  orders: { id: string; orderNumber: string }[];
}

/** Where a design stands with respect to orders, from the order lines that carry it. */
export function designOrderState(lines: DesignOrderLine[]): DesignOrderState {
  const placed = new Map<string, string>();
  for (const line of lines) {
    if (line.status !== "draft") placed.set(line.orderId, line.orderNumber);
  }
  return {
    inBasket: lines.some((line) => line.status === "draft"),
    orders: [...placed].map(([id, orderNumber]) => ({ id, orderNumber })),
  };
}

/** Who owns the design, for the editor's banner: an account's name or email, else a guest. */
export function designOwnerLabel(owner: { name: string | null; email: string } | null): string {
  return owner ? (owner.name?.trim() || owner.email) : "a guest";
}

/**
 * The owner a design's row names: its account, else its guest. Null for a row
 * with neither, which nothing should write — so a photo an admin adds is never
 * filed under no one.
 */
export function designOwner(row: { userId: string | null; guestToken: string | null }): Owner | null {
  if (row.userId) return { userId: row.userId, guestToken: null };
  if (row.guestToken) return { userId: null, guestToken: row.guestToken };
  return null;
}
