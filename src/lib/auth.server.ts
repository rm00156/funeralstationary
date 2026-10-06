/**
 * Email sign-in — the stateful half of src/lib/auth.ts.
 *
 * There is no password. A customer types their email, we send a one-time
 * link, and clicking it proves the address: that click (and only that
 * click) creates the users row, marks the email verified, sets the session
 * cookie and *claims* what the visitor already owns —
 *
 *   1. everything under the browser's guest token (designs, uploads, the
 *      basket), so work started as a guest is not stranded, and
 *   2. every paid order whose contact email is the one just proven, plus
 *      the designs and uploaded artwork on those orders, so an order placed
 *      as a guest is found again from any device.
 *
 * Nothing is ever attached to an account on the strength of an address
 * merely *typed* — at checkout or in the form — because typing someone
 * else's email must not pollute their account or hand anything over.
 *
 * Without Resend configured, development hands the link back to the form to
 * show on screen (and logs it) so the flow can be tried locally; production
 * answers 503.
 */
import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { isDuplicateKeyError } from "@/db/errors";
import {
  artworkUploads,
  designAssets,
  designs,
  loginTokens,
  orderItems,
  orders,
  users,
} from "@/db/schema";
import {
  LOGIN_LINK_TTL_SECONDS,
  generateLoginSecret,
  hashLoginSecret,
  isValidEmail,
  loginLinkUrl,
  normaliseEmail,
  safeNextPath,
} from "@/lib/auth";
import { isEmailConfigured, sendEmail } from "@/lib/email.server";
import { signInEmail } from "@/lib/orderEmails";
import { authConfigured, readUserId } from "@/lib/userSession";

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
}

/**
 * The signed-in customer, or null. React-cached per request so the header
 * and the page share one lookup. A cookie naming a user that no longer
 * exists reads as signed out.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const userId = await readUserId();
  if (!userId) return null;
  const [row] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
});

/** A client-caused failure the route can map straight to a status code. */
export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 503,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Create a one-time link for an address and return its URL. The secret is
 * returned to the caller only — the database keeps its hash.
 */
async function createLoginLink(input: {
  email: string;
  origin: string;
  next?: string;
}): Promise<{ email: string; url: string; expiresAt: Date }> {
  if (!authConfigured()) {
    throw new AuthError("Accounts are not configured — set AUTH_SECRET (see .env.example).", 503);
  }
  const email = normaliseEmail(input.email);
  if (!isValidEmail(email)) throw new AuthError("Please enter a valid email address.", 400);

  const secret = generateLoginSecret();
  const expiresAt = new Date(Date.now() + LOGIN_LINK_TTL_SECONDS * 1000);
  await db.insert(loginTokens).values({
    id: crypto.randomUUID(),
    tokenHash: hashLoginSecret(secret),
    email,
    redirectTo: safeNextPath(input.next),
    expiresAt,
  });
  return { email, url: loginLinkUrl(input.origin, secret), expiresAt };
}

/**
 * Send a sign-in link from the sign-in form. Resolves whether or not the
 * address has an account — the response must not reveal which.
 */
export async function requestSignInLink(input: {
  email: string;
  origin: string;
  next?: string;
}): Promise<{ developmentLink: string | null }> {
  const link = await createLoginLink(input);
  if (isEmailConfigured()) {
    await sendEmail({ to: link.email, ...signInEmail(link.url) });
    return { developmentLink: null };
  }
  if (process.env.NODE_ENV === "production") {
    throw new AuthError("Email is not configured, so we can't send a sign-in link right now.", 503);
  }
  console.info(`[auth] Email is not configured. Sign-in link for ${link.email}:\n  ${link.url}`);
  return { developmentLink: link.url };
}

export type ConsumeResult =
  | { ok: true; userId: string; email: string; redirectTo: string }
  | { ok: false; reason: "invalid" | "expired" | "used" };

/**
 * Spend a link. One atomic conditional UPDATE marks the row consumed — two
 * clicks on the same link race, and only one wins — then the users row is
 * found or created for its email.
 */
export async function consumeLoginToken(secret: string): Promise<ConsumeResult> {
  if (!authConfigured() || !secret) return { ok: false, reason: "invalid" };
  const tokenHash = hashLoginSecret(secret);
  const [row] = await db
    .select({
      id: loginTokens.id,
      email: loginTokens.email,
      redirectTo: loginTokens.redirectTo,
      expiresAt: loginTokens.expiresAt,
      consumedAt: loginTokens.consumedAt,
    })
    .from(loginTokens)
    .where(eq(loginTokens.tokenHash, tokenHash))
    .limit(1);
  if (!row) return { ok: false, reason: "invalid" };
  if (row.consumedAt) return { ok: false, reason: "used" };
  const now = new Date();
  if (row.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };

  const [result] = await db
    .update(loginTokens)
    .set({ consumedAt: now })
    .where(and(eq(loginTokens.id, row.id), isNull(loginTokens.consumedAt)));
  if (result.affectedRows === 0) return { ok: false, reason: "used" };

  const userId = await findOrCreateUser(row.email, now);
  return { ok: true, userId, email: row.email, redirectTo: safeNextPath(row.redirectTo) };
}

async function findOrCreateUser(email: string, verifiedAt: Date): Promise<string> {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    await db
      .update(users)
      .set({ emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, ${verifiedAt})` })
      .where(eq(users.id, existing.id));
    return existing.id;
  }
  const id = crypto.randomUUID();
  try {
    await db.insert(users).values({ id, email, emailVerifiedAt: verifiedAt });
    return id;
  } catch (error) {
    // Two links for a brand-new address clicked at once: the loser reads the winner's row.
    if (!isDuplicateKeyError(error)) throw error;
    const [winner] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (!winner) throw error;
    return winner.id;
  }
}

/**
 * Attach to a freshly signed-in user everything they can be shown to own:
 * the rows under this browser's guest token, and the paid orders addressed
 * to the email they just proved (with the designs and uploads on them).
 * Idempotent.
 */
export async function claimOwnership(input: {
  userId: string;
  email: string;
  guestToken: string | null;
}): Promise<void> {
  const { userId, email, guestToken } = input;
  if (guestToken) await claimGuestRows(userId, guestToken);
  await claimOrdersByEmail(userId, email);
}

async function claimGuestRows(userId: string, guestToken: string): Promise<void> {
  await db
    .update(designs)
    .set({ userId, guestToken: null })
    .where(and(eq(designs.guestToken, guestToken), isNull(designs.userId)));
  await db
    .update(designAssets)
    .set({ userId, guestToken: null })
    .where(and(eq(designAssets.guestToken, guestToken), isNull(designAssets.userId)));
  await db
    .update(artworkUploads)
    .set({ userId, guestToken: null })
    .where(and(eq(artworkUploads.guestToken, guestToken), isNull(artworkUploads.userId)));

  // Two baskets — the account's and this browser's — become one: the guest
  // basket's lines move onto the account's draft (skipping designs already
  // in it) and the empty guest draft is dropped. Any other guest orders are
  // simply re-owned.
  const [accountDraft] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.status, "draft")))
    .orderBy(desc(orders.createdAt))
    .limit(1);
  const [guestDraft] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.guestToken, guestToken), isNull(orders.userId), eq(orders.status, "draft")))
    .orderBy(desc(orders.createdAt))
    .limit(1);
  if (accountDraft && guestDraft) {
    const [existing, incoming] = await Promise.all([
      db
        .select({ designId: orderItems.designId, position: orderItems.position })
        .from(orderItems)
        .where(eq(orderItems.orderId, accountDraft.id)),
      db
        .select({ id: orderItems.id, designId: orderItems.designId })
        .from(orderItems)
        .where(eq(orderItems.orderId, guestDraft.id)),
    ]);
    const present = new Set(existing.map((item) => item.designId));
    let position = existing.reduce((max, item) => Math.max(max, item.position), -1) + 1;
    for (const item of incoming) {
      if (item.designId && present.has(item.designId)) {
        await db.delete(orderItems).where(eq(orderItems.id, item.id));
        continue;
      }
      await db
        .update(orderItems)
        .set({ orderId: accountDraft.id, position })
        .where(eq(orderItems.id, item.id));
      position += 1;
    }
    await db.delete(orders).where(eq(orders.id, guestDraft.id));
  }

  await db
    .update(orders)
    .set({ userId, guestToken: null, guestEmail: null })
    .where(and(eq(orders.guestToken, guestToken), isNull(orders.userId)));
}

async function claimOrdersByEmail(userId: string, email: string): Promise<void> {
  const placed = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        isNull(orders.userId),
        ne(orders.status, "draft"),
        sql`lower(${orders.contactEmail}) = ${email}`,
      ),
    );
  if (placed.length === 0) return;
  const orderIds = placed.map((row) => row.id);

  const lines = await db
    .select({ designId: orderItems.designId, uploadId: orderItems.uploadId })
    .from(orderItems)
    .where(inArray(orderItems.orderId, orderIds));
  const designIds = [...new Set(lines.flatMap((line) => (line.designId ? [line.designId] : [])))];
  if (designIds.length > 0) {
    await db
      .update(designs)
      .set({ userId, guestToken: null })
      .where(and(inArray(designs.id, designIds), isNull(designs.userId)));
  }
  const uploadIds = [...new Set(lines.flatMap((line) => (line.uploadId ? [line.uploadId] : [])))];
  if (uploadIds.length > 0) {
    await db
      .update(artworkUploads)
      .set({ userId, guestToken: null })
      .where(and(inArray(artworkUploads.id, uploadIds), isNull(artworkUploads.userId)));
  }
  await db
    .update(orders)
    .set({ userId, guestToken: null, guestEmail: null })
    .where(and(inArray(orders.id, orderIds), isNull(orders.userId)));
}

