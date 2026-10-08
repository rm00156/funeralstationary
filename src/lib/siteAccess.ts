/**
 * Whether the online shop is open: the business pays a monthly subscription
 * for the site, and while it is unpaid customers can browse but not design,
 * upload or buy. Pure and tested; siteBilling.server.ts is the seam that
 * reads the stored subscription and the switch.
 *
 * The rule follows Thintent's (lib/entitlement.ts there) with one fix: a
 * subscription Stripe has ended is closed at once, whatever period end it
 * last reported. Only a portal cancellation (`cancel_at_period_end`, or a
 * `cancel_at` date), which Stripe leaves `active` until the date, runs on —
 * and it closes on that date by the clock, not when the `deleted` event
 * arrives, so a missed webhook can't keep a cancelled shop open.
 *
 * A failed payment keeps the shop open for PAST_DUE_GRACE_DAYS, not for as
 * long as Stripe says `past_due`: what Stripe does when its retries run out is
 * a dashboard setting, and "leave the subscription past-due" would otherwise
 * keep an unpaid shop open for good.
 */

/** How long a failed payment keeps the shop open — Stripe's default retry window. */
export const PAST_DUE_GRACE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export type SubscriptionState = {
  /** Stripe's own status word, or null when the site has never subscribed. */
  status: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  /**
   * While `past_due`: when the oldest unpaid invoice fell due, which starts
   * the grace. Null otherwise, and also when it couldn't be read, in which
   * case the shop stays open while Stripe retries.
   */
  pastDueSince?: Date | null;
};

export type SiteAccessReason =
  /** Paid up. */
  | "subscribed"
  /** Paid up, cancelled in the portal; closes at currentPeriodEnd. */
  | "cancelling"
  /** A payment failed. Stays open while Stripe retries the card, for up to PAST_DUE_GRACE_DAYS. */
  | "past_due"
  /** A payment failed more than PAST_DUE_GRACE_DAYS ago and still hasn't been paid. */
  | "overdue"
  /** Checkout started but the first payment hasn't completed (e.g. awaiting 3-D Secure). */
  | "incomplete"
  | "never_subscribed"
  /** Cancelled, unpaid after the retries, or paused. */
  | "lapsed";

export type SiteAccess = {
  /** What customers get: the shop is open when payment isn't required yet, or the subscription is good. */
  open: boolean;
  /** Whether the subscription itself is in good standing, regardless of the switch. */
  entitled: boolean;
  /** The switch (SUBSCRIPTION_REQUIRED): off, nothing is gated. */
  required: boolean;
  reason: SiteAccessReason;
  currentPeriodEnd: Date | null;
  /** While `past_due`: when the shop closes unless the payment goes through. */
  closesAt: Date | null;
};

/** The statuses that keep the shop open. Anything else Stripe reports — including statuses added later — closes it. */
const ENTITLED_STATUSES = new Set(["active", "trialing", "past_due"]);

/**
 * Whether a subscription in this status is one to pay or manage rather than
 * replace — good standing, or past due however long (settled in the portal).
 */
export function holdsSubscription(status: string): boolean {
  return ENTITLED_STATUSES.has(status);
}

/** When a failed payment's grace runs out, or null when nothing is overdue. */
export function pastDueClosesAt(state: SubscriptionState | null): Date | null {
  if (state?.status !== "past_due" || !state.pastDueSince) return null;
  return new Date(state.pastDueSince.getTime() + PAST_DUE_GRACE_DAYS * DAY_MS);
}

export function subscriptionReason(state: SubscriptionState | null, now: Date = new Date()): SiteAccessReason {
  switch (state?.status ?? null) {
    case null:
    case "incomplete_expired":
      return "never_subscribed";
    case "active":
    case "trialing":
      if (!state?.cancelAtPeriodEnd) return "subscribed";
      return state.currentPeriodEnd && now >= state.currentPeriodEnd ? "lapsed" : "cancelling";
    case "past_due": {
      const closesAt = pastDueClosesAt(state);
      return closesAt && now >= closesAt ? "overdue" : "past_due";
    }
    case "incomplete":
      return "incomplete";
    default:
      return "lapsed";
  }
}

export function siteAccessFor(
  state: SubscriptionState | null,
  required: boolean,
  now: Date = new Date(),
): SiteAccess {
  const reason = subscriptionReason(state, now);
  const entitled = ENTITLED_STATUSES.has(state?.status ?? "") && reason !== "overdue" && reason !== "lapsed";
  return {
    open: !required || entitled,
    entitled,
    required,
    reason,
    currentPeriodEnd: state?.currentPeriodEnd ?? null,
    closesAt: reason === "past_due" ? pastDueClosesAt(state) : null,
  };
}

/** The bits of a Stripe subscription this module reads. */
export type StripeSubscriptionLike = {
  id: string;
  status: string;
  created: number;
  cancel_at_period_end?: boolean | null;
  /** Set instead of cancel_at_period_end by newer billing-portal cancellations. */
  cancel_at?: number | null;
  /** Stripe moved current_period_end onto subscription items in API 2025-03-31. */
  items: { data: Array<{ current_period_end?: number | null }> };
};

/**
 * Of a customer's subscriptions, the one that decides access: a good one if
 * any (re-subscribing after a lapse makes a second subscription, and the old
 * one's late events must not close the shop again), otherwise the newest.
 */
export function pickSubscription<T extends StripeSubscriptionLike>(subscriptions: readonly T[]): T | null {
  const newestFirst = [...subscriptions].sort((a, b) => b.created - a.created);
  return newestFirst.find((sub) => ENTITLED_STATUSES.has(sub.status)) ?? newestFirst[0] ?? null;
}

export function subscriptionStateFrom(sub: StripeSubscriptionLike): SubscriptionState & {
  subscriptionId: string;
} {
  // A cancel_at date is when the subscription actually ends, so it's the date
  // the shop closes; otherwise the end of the period paid for.
  const periodEnd = sub.cancel_at ?? sub.items.data[0]?.current_period_end;
  return {
    subscriptionId: sub.id,
    status: sub.status,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end || sub.cancel_at),
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
  };
}

/** The bits of a Stripe invoice oldestUnpaidSince reads. */
export type StripeInvoiceLike = {
  created: number;
  status_transitions: { finalized_at?: number | null };
};

/**
 * When the oldest of a subscription's open invoices fell due — the start of
 * the past-due grace. The oldest, not the latest: left past-due, Stripe raises
 * next month's renewal on top, and that must not restart the grace.
 */
export function oldestUnpaidSince(openInvoices: readonly StripeInvoiceLike[]): Date | null {
  const dueAt = openInvoices.map((invoice) => invoice.status_transitions.finalized_at ?? invoice.created);
  return dueAt.length ? new Date(Math.min(...dueAt) * 1000) : null;
}

/** The bits of a Stripe event billingEventCustomerId reads. */
export type BillingEventLike = { type: string; data: { object: unknown } };

/**
 * The customer a billing webhook event is about, or undefined for an event
 * that can't change the subscription (the route answers it 200 untouched).
 */
export function billingEventCustomerId(event: BillingEventLike): string | null | undefined {
  const object = event.data.object as { customer?: string | { id: string } | null; mode?: string | null };
  switch (event.type) {
    case "checkout.session.completed":
      // The shared account also takes one-off payments; only a subscription checkout counts.
      return object.mode === "subscription" ? idOf(object.customer) : undefined;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
    // Paying one of two open invoices changes when the grace started without
    // changing the subscription's status, so no subscription event says so.
    case "invoice.paid":
    case "invoice.payment_failed":
    case "invoice.voided":
    case "invoice.marked_uncollectible":
      return idOf(object.customer);
    default:
      return undefined;
  }
}

function idOf(ref: string | { id: string } | null | undefined): string | null {
  return typeof ref === "string" ? ref : (ref?.id ?? null);
}

/** "8 November 2026", in the shop's own time zone. */
export function formatBillingDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/London" }).format(date);
}

/**
 * The warning across the top of every /admin page, or null when there's
 * nothing to act on. Silent while payment isn't required: nothing can close.
 */
export function billingNotice(access: SiteAccess): string | null {
  if (!access.required) return null;
  if (access.reason === "overdue") {
    return `The online shop is closed: the subscription payment is still unpaid after ${PAST_DUE_GRACE_DAYS} days. Update the card in billing to reopen it.`;
  }
  if (!access.open) {
    return "The online shop is closed: customers can look at the designs but can’t design, upload or order. Subscribe to open it again.";
  }
  if (access.reason === "past_due") {
    return access.closesAt
      ? `We couldn’t take the last subscription payment. The shop stays open until ${formatBillingDate(access.closesAt)} while Stripe tries the card again — update the card to keep it open.`
      : "We couldn’t take the last subscription payment. The shop stays open while Stripe tries the card again — update the card to keep it open.";
  }
  if (access.reason === "cancelling") {
    return access.currentPeriodEnd
      ? `The subscription is cancelled. The online shop closes on ${formatBillingDate(access.currentPeriodEnd)} unless it’s renewed.`
      : "The subscription is cancelled. The online shop closes at the end of the period paid for unless it’s renewed.";
  }
  return null;
}
