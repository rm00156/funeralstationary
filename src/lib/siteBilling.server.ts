/**
 * The site's own subscription: what the business pays each month to keep the
 * online shop open. The rule is pure (siteAccess.ts); this is the seam that
 * stores it and talks to Stripe.
 *
 * It bills on its own Stripe account, BILLING_STRIPE_SECRET_KEY — not the
 * STRIPE_SECRET_KEY customers pay for orders through, which belongs to the
 * business. Today the two may be the same account (and the same account as
 * Thintent's own subscriptions), so the webhook acts only on this site's
 * customer and ignores every other subscription it hears about.
 *
 * The switch is SUBSCRIPTION_REQUIRED=1. Unset, nothing is gated — the
 * subscription can still be taken out and is shown in /admin/billing.
 */
import { and, eq, isNull } from "drizzle-orm";
import { cache } from "react";
import Stripe from "stripe";

import { db } from "@/db";
import { siteBilling } from "@/db/schema";
import { COMPANY_NAME, EMAIL, SITE_NAME } from "@/lib/site";
import {
  holdsSubscription,
  oldestUnpaidSince,
  pickSubscription,
  siteAccessFor,
  subscriptionStateFrom,
  type SiteAccess,
  type SubscriptionState,
} from "@/lib/siteAccess";

const ROW_ID = 1;
/** Marks this site's Stripe objects, so a shared account's dashboard (and a stray event) says whose they are. */
const STRIPE_MARKER = { app: "funeral-stationery" };

export function subscriptionRequired(): boolean {
  return process.env.SUBSCRIPTION_REQUIRED === "1";
}

export function billingConfigured(): boolean {
  return !!process.env.BILLING_STRIPE_SECRET_KEY && !!process.env.BILLING_STRIPE_PRICE_ID;
}

let client: Stripe | undefined;

function billingStripe(): Stripe {
  const key = process.env.BILLING_STRIPE_SECRET_KEY;
  if (!key) throw new Error("Billing is not configured — set BILLING_STRIPE_SECRET_KEY (see .env.example).");
  if (!client) client = new Stripe(key);
  return client;
}

type BillingRow = typeof siteBilling.$inferSelect;

async function readRow(): Promise<BillingRow | null> {
  const [row] = await db.select().from(siteBilling).where(eq(siteBilling.id, ROW_ID)).limit(1);
  return row ?? null;
}

function stateOf(row: BillingRow | null): SubscriptionState | null {
  if (!row?.subscriptionStatus) return null;
  return {
    status: row.subscriptionStatus,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    currentPeriodEnd: row.currentPeriodEnd,
    pastDueSince: row.pastDueSince,
  };
}

/** The full picture, read now — for /admin/billing, straight after it re-syncs. */
export async function readSiteAccess(): Promise<SiteAccess> {
  return siteAccessFor(stateOf(await readRow()), subscriptionRequired());
}

/** The same, request-cached, for the gated pages and the admin layout. */
export const getSiteAccess = cache(readSiteAccess);

/**
 * Whether customers may design, upload and buy. With the switch off this
 * reads nothing, so the shop never depends on the billing table.
 */
export const isShopOpen = cache(async (): Promise<boolean> => {
  if (!subscriptionRequired()) return true;
  return (await getSiteAccess()).open;
});

/** The answer every gated customer route gives while the shop is closed. */
export function shopClosedResponse(): Response {
  return Response.json(
    {
      error: "We’re not taking orders online just now. Please call or email us and we’ll help.",
      reason: "shop-closed",
    },
    { status: 503 },
  );
}

/**
 * The billing customer, created once and stored before any Checkout is
 * started, so an abandoned checkout can't leave a second customer behind.
 * Two racing clicks keep whichever was stored first.
 */
async function ensureBillingCustomer(): Promise<string> {
  const existing = await readRow();
  if (existing?.stripeCustomerId) {
    if (await customerExists(existing.stripeCustomerId)) return existing.stripeCustomerId;
    // Made under another key — test mode before going live, or another
    // account. Nothing stored about it means anything on this one.
    await db
      .update(siteBilling)
      .set({
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        subscriptionStatus: null,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        pastDueSince: null,
      })
      .where(eq(siteBilling.id, ROW_ID));
  }

  const customer = await billingStripe().customers.create({
    email: EMAIL,
    name: `${SITE_NAME} (${COMPANY_NAME})`,
    metadata: STRIPE_MARKER,
  });
  await db
    .insert(siteBilling)
    .values({ id: ROW_ID })
    .onDuplicateKeyUpdate({ set: { id: ROW_ID } });
  await db
    .update(siteBilling)
    .set({ stripeCustomerId: customer.id })
    .where(and(eq(siteBilling.id, ROW_ID), isNull(siteBilling.stripeCustomerId)));
  const row = await readRow();
  if (row?.stripeCustomerId && row.stripeCustomerId !== customer.id) {
    // Lost the race: drop ours so the account isn't left with a spare.
    await billingStripe().customers.del(customer.id).catch(() => undefined);
  }
  return row?.stripeCustomerId ?? customer.id;
}

async function customerExists(id: string): Promise<boolean> {
  try {
    const customer = await billingStripe().customers.retrieve(id);
    return !customer.deleted;
  } catch (error) {
    if (error instanceof Stripe.errors.StripeInvalidRequestError && error.code === "resource_missing") {
      return false;
    }
    throw error;
  }
}

/** Subscribe was pressed while the site already has a subscription to pay or manage. */
export class AlreadySubscribedError extends Error {
  constructor() {
    super("The site already has a subscription");
  }
}

/**
 * Hosted Checkout for the monthly subscription. Returns the URL to send the
 * admin to.
 *
 * The page hides Subscribe once there's a subscription, but a second tab or a
 * page loaded before the webhook landed still shows it, so this asks Stripe
 * itself: a subscription in good standing (or past due — that's settled in
 * the portal, not replaced) refuses. Any Checkout still open from an earlier
 * click is expired first, so two tabs can't both be paid.
 */
export async function startSubscriptionCheckout(origin: string): Promise<string> {
  const price = process.env.BILLING_STRIPE_PRICE_ID;
  if (!price) throw new Error("BILLING_STRIPE_PRICE_ID is not set");
  const customer = await ensureBillingCustomer();
  const stripe = billingStripe();

  const existing = await stripe.subscriptions.list({ customer, status: "all", limit: 20 });
  const current = pickSubscription(existing.data);
  if (current && holdsSubscription(current.status)) throw new AlreadySubscribedError();

  const open = await stripe.checkout.sessions.list({ customer, status: "open", limit: 20 });
  await Promise.all(open.data.map((earlier) => stripe.checkout.sessions.expire(earlier.id)));

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${origin}/api/admin/billing/return?subscribed=1`,
    cancel_url: `${origin}/admin/billing`,
    metadata: STRIPE_MARKER,
    subscription_data: { metadata: STRIPE_MARKER },
  });
  if (!session.url) throw new Error("Stripe returned a checkout session with no URL");
  return session.url;
}

/** Stripe's billing portal: card changes, cancelling, invoices and receipts. */
export async function openBillingPortal(origin: string): Promise<string> {
  const row = await readRow();
  if (!row?.stripeCustomerId) throw new Error("There is no subscription to manage yet");
  const session = await billingStripe().billingPortal.sessions.create({
    customer: row.stripeCustomerId,
    return_url: `${origin}/api/admin/billing/return`,
  });
  return session.url;
}

/**
 * Re-read the customer's subscriptions from Stripe and store the one that
 * decides access (pickSubscription). Every path — the webhook, the return
 * from Checkout, opening /admin/billing — goes through here, so a late or
 * repeated event can't leave a stale state behind.
 *
 * One sync at a time: the row is locked across the Stripe read, so the
 * events Checkout fires together (`created` while incomplete, `updated` once
 * paid) can't have the one that read older state write last. Each sync reads
 * Stripe after the one before it has stored, so the last write is the newest.
 * Readers aren't blocked — a plain SELECT doesn't wait on the lock.
 */
export async function syncSiteSubscription(): Promise<void> {
  if (!billingConfigured()) return;
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(siteBilling).where(eq(siteBilling.id, ROW_ID)).for("update");
    if (!row?.stripeCustomerId) return;
    const list = await billingStripe().subscriptions.list({
      customer: row.stripeCustomerId,
      status: "all",
      limit: 20,
    });
    const sub = pickSubscription(list.data);
    if (!sub) return;
    const state = subscriptionStateFrom(sub);
    const pastDueSince =
      state.status === "past_due" ? ((await oldestUnpaidInvoiceDate(sub.id)) ?? row.pastDueSince ?? new Date()) : null;
    await tx
      .update(siteBilling)
      .set({
        stripeSubscriptionId: state.subscriptionId,
        subscriptionStatus: state.status,
        cancelAtPeriodEnd: state.cancelAtPeriodEnd,
        currentPeriodEnd: state.currentPeriodEnd,
        pastDueSince,
      })
      .where(eq(siteBilling.id, ROW_ID));
  });
}

/**
 * When the subscription's oldest unpaid invoice fell due (oldestUnpaidSince).
 * Paying the oldest of two leaves the status past_due, so no subscription
 * event fires — the webhook listens to invoice events too, so the clock moves
 * on to the next one.
 */
async function oldestUnpaidInvoiceDate(subscriptionId: string): Promise<Date | null> {
  const open = await billingStripe().invoices.list({ subscription: subscriptionId, status: "open", limit: 100 });
  return oldestUnpaidSince(open.data);
}

/** Whether a billing event is about this site's customer — the account may be shared. */
export async function isSiteBillingCustomer(customerId: string | null): Promise<boolean> {
  if (!customerId) return false;
  const row = await readRow();
  return row?.stripeCustomerId === customerId;
}

export function constructBillingWebhookEvent(rawBody: string, signature: string | null): Stripe.Event {
  const secret = process.env.BILLING_STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("BILLING_STRIPE_WEBHOOK_SECRET is not set");
  if (!signature) throw new Error("Missing stripe-signature header");
  return billingStripe().webhooks.constructEvent(rawBody, signature, secret);
}

/** The monthly price as Stripe holds it, so the page can't disagree with what's charged. */
export async function getSubscriptionPrice(): Promise<{ amountPence: number; interval: string } | null> {
  const id = process.env.BILLING_STRIPE_PRICE_ID;
  if (!id || !billingConfigured()) return null;
  try {
    const price = await billingStripe().prices.retrieve(id);
    if (price.unit_amount === null) return null;
    return { amountPence: price.unit_amount, interval: price.recurring?.interval ?? "month" };
  } catch (error) {
    // A price lookup never takes the billing page down; Subscribe still works.
    console.error("Billing: couldn't read the subscription price", error);
    return null;
  }
}
