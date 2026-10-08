import { describe, expect, it } from "vitest";

import {
  billingEventCustomerId,
  billingNotice,
  holdsSubscription,
  oldestUnpaidSince,
  PAST_DUE_GRACE_DAYS,
  pickSubscription,
  siteAccessFor,
  subscriptionStateFrom,
  type StripeSubscriptionLike,
  type SubscriptionState,
} from "@/lib/siteAccess";

const state = (status: string | null, extra: Partial<SubscriptionState> = {}): SubscriptionState => ({
  status,
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
  ...extra,
});

const sub = (id: string, status: string, created: number, extra: Partial<StripeSubscriptionLike> = {}) => ({
  id,
  status,
  created,
  items: { data: [{ current_period_end: 1_800_000_000 }] },
  ...extra,
});

describe("siteAccessFor", () => {
  it("leaves the shop open whatever the subscription while payment isn't required", () => {
    for (const status of [null, "canceled", "unpaid", "incomplete"]) {
      const access = siteAccessFor(state(status), false);
      expect(access.open).toBe(true);
      expect(access.entitled).toBe(false);
    }
  });

  it("opens the shop for a subscription in good standing", () => {
    expect(siteAccessFor(state("active"), true)).toMatchObject({ open: true, reason: "subscribed" });
    expect(siteAccessFor(state("trialing"), true)).toMatchObject({ open: true, reason: "subscribed" });
  });

  it("keeps a failed payment open while Stripe retries the card", () => {
    expect(siteAccessFor(state("past_due"), true)).toMatchObject({ open: true, reason: "past_due", closesAt: null });
  });

  it("closes a failed payment once the grace runs out, whatever Stripe still calls it", () => {
    const since = new Date("2026-10-08T03:00:00Z");
    const closesAt = new Date(since.getTime() + PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000);
    const pastDue = state("past_due", { pastDueSince: since });
    expect(siteAccessFor(pastDue, true, new Date(closesAt.getTime() - 1))).toMatchObject({
      open: true,
      entitled: true,
      reason: "past_due",
      closesAt,
    });
    expect(siteAccessFor(pastDue, true, closesAt)).toMatchObject({
      open: false,
      entitled: false,
      reason: "overdue",
      closesAt: null,
    });
    // The switch still wins.
    expect(siteAccessFor(pastDue, false, closesAt)).toMatchObject({ open: true, reason: "overdue" });
  });

  it("keeps a portal cancellation open until its date, then closes it without waiting for Stripe", () => {
    const end = new Date("2026-11-08T00:00:00Z");
    const cancelling = state("active", { cancelAtPeriodEnd: true, currentPeriodEnd: end });
    expect(siteAccessFor(cancelling, true, new Date(end.getTime() - 1))).toEqual({
      open: true,
      entitled: true,
      required: true,
      reason: "cancelling",
      currentPeriodEnd: end,
      closesAt: null,
    });
    // The `deleted` event never arrived: the stored status still says active.
    expect(siteAccessFor(cancelling, true, end)).toMatchObject({ open: false, entitled: false, reason: "lapsed" });
    // A plain renewal date in the past is only a missed renewal event, not a reason to close.
    expect(siteAccessFor(state("active", { currentPeriodEnd: end }), true, new Date("2027-01-01"))).toMatchObject({
      open: true,
      reason: "subscribed",
    });
  });

  it("closes the shop once Stripe has ended the subscription, even with a future period end", () => {
    const access = siteAccessFor(state("canceled", { currentPeriodEnd: new Date("2099-01-01") }), true);
    expect(access).toMatchObject({ open: false, reason: "lapsed" });
  });

  it("closes the shop for every other status, including ones Stripe adds later", () => {
    expect(siteAccessFor(null, true)).toMatchObject({ open: false, reason: "never_subscribed" });
    expect(siteAccessFor(state("incomplete_expired"), true)).toMatchObject({ open: false, reason: "never_subscribed" });
    expect(siteAccessFor(state("incomplete"), true)).toMatchObject({ open: false, reason: "incomplete" });
    for (const status of ["unpaid", "paused", "something_new"]) {
      expect(siteAccessFor(state(status), true)).toMatchObject({ open: false, reason: "lapsed" });
    }
  });
});

describe("pickSubscription", () => {
  it("prefers a good subscription over a newer ended one", () => {
    const picked = pickSubscription([sub("old", "active", 100), sub("newer", "canceled", 200)]);
    expect(picked?.id).toBe("old");
  });

  it("takes the newest good one, and the newest of all when none is good", () => {
    expect(pickSubscription([sub("a", "active", 100), sub("b", "past_due", 300)])?.id).toBe("b");
    expect(pickSubscription([sub("a", "canceled", 100), sub("b", "unpaid", 300)])?.id).toBe("b");
    expect(pickSubscription([])).toBeNull();
  });
});

describe("subscriptionStateFrom", () => {
  it("reads the period end from the subscription item", () => {
    expect(subscriptionStateFrom(sub("s", "active", 1))).toEqual({
      subscriptionId: "s",
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: new Date(1_800_000_000 * 1000),
    });
  });

  it("treats either kind of portal cancellation as cancelling, closing on cancel_at when set", () => {
    expect(subscriptionStateFrom(sub("s", "active", 1, { cancel_at_period_end: true })).cancelAtPeriodEnd).toBe(true);
    const at = subscriptionStateFrom(sub("s", "active", 1, { cancel_at: 1_790_000_000 }));
    expect(at.cancelAtPeriodEnd).toBe(true);
    expect(at.currentPeriodEnd).toEqual(new Date(1_790_000_000 * 1000));
  });
});

describe("billingNotice", () => {
  it("says nothing while payment isn't required, or while all is well", () => {
    expect(billingNotice(siteAccessFor(null, false))).toBeNull();
    expect(billingNotice(siteAccessFor(state("past_due"), false))).toBeNull();
    expect(billingNotice(siteAccessFor(state("active"), true))).toBeNull();
  });

  it("warns when the shop is closed, a payment failed, or it's about to close", () => {
    expect(billingNotice(siteAccessFor(state("canceled"), true))).toMatch(/closed/);
    expect(billingNotice(siteAccessFor(state("past_due"), true))).toMatch(/couldn’t take/);
    const since = new Date("2026-10-08T12:00:00Z");
    const pastDue = state("past_due", { pastDueSince: since });
    expect(billingNotice(siteAccessFor(pastDue, true, since))).toMatch(/stays open until 22 October 2026/);
    expect(billingNotice(siteAccessFor(pastDue, true, new Date("2026-10-23T00:00:00Z")))).toMatch(
      /closed: the subscription payment is still unpaid/,
    );
    const end = new Date("2026-11-08T12:00:00Z");
    expect(
      billingNotice(siteAccessFor(state("active", { cancelAtPeriodEnd: true, currentPeriodEnd: end }), true)),
    ).toMatch(/closes on 8 November 2026/);
  });
});

describe("holdsSubscription", () => {
  it("refuses a second subscription while one is good or still being paid", () => {
    // past_due however long — an overdue one is settled in the portal, not replaced.
    for (const status of ["active", "trialing", "past_due"]) expect(holdsSubscription(status)).toBe(true);
  });

  it("lets the site subscribe again once the old one is over or never got going", () => {
    for (const status of ["canceled", "unpaid", "paused", "incomplete", "incomplete_expired", "something_new"]) {
      expect(holdsSubscription(status)).toBe(false);
    }
  });
});

describe("oldestUnpaidSince", () => {
  const invoice = (created: number, finalizedAt: number | null = null) => ({
    created,
    status_transitions: { finalized_at: finalizedAt },
  });

  it("starts the grace at the oldest open invoice, so next month's renewal can't restart it", () => {
    const september = Date.UTC(2026, 8, 1) / 1000;
    const october = Date.UTC(2026, 9, 1) / 1000;
    expect(oldestUnpaidSince([invoice(october), invoice(september)])).toEqual(new Date(september * 1000));
  });

  it("moves on to the next invoice once the oldest is paid (it drops out of the open list)", () => {
    const october = Date.UTC(2026, 9, 1) / 1000;
    expect(oldestUnpaidSince([invoice(october)])).toEqual(new Date(october * 1000));
  });

  it("reads when the invoice was finalised over when its draft was made", () => {
    const drafted = Date.UTC(2026, 9, 1) / 1000;
    const finalised = Date.UTC(2026, 9, 2) / 1000;
    expect(oldestUnpaidSince([invoice(drafted, finalised)])).toEqual(new Date(finalised * 1000));
  });

  it("is null with nothing open", () => {
    expect(oldestUnpaidSince([])).toBeNull();
  });
});

describe("billingEventCustomerId", () => {
  const event = (type: string, object: Record<string, unknown>) => ({ type, data: { object } });

  it("acts on every subscription and invoice event that can change access", () => {
    for (const type of [
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "customer.subscription.paused",
      "customer.subscription.resumed",
      "invoice.paid",
      "invoice.payment_failed",
      "invoice.voided",
      "invoice.marked_uncollectible",
    ]) {
      expect(billingEventCustomerId(event(type, { customer: "cus_1" }))).toBe("cus_1");
    }
  });

  it("reads an expanded customer as well as an id", () => {
    expect(billingEventCustomerId(event("invoice.paid", { customer: { id: "cus_1" } }))).toBe("cus_1");
    expect(billingEventCustomerId(event("invoice.paid", { customer: null }))).toBeNull();
  });

  it("acts on a completed checkout only when it was a subscription", () => {
    expect(
      billingEventCustomerId(event("checkout.session.completed", { mode: "subscription", customer: "cus_1" })),
    ).toBe("cus_1");
    expect(
      billingEventCustomerId(event("checkout.session.completed", { mode: "payment", customer: "cus_1" })),
    ).toBeUndefined();
  });

  it("leaves every other event alone", () => {
    for (const type of ["invoice.created", "customer.updated", "payment_intent.succeeded"]) {
      expect(billingEventCustomerId(event(type, { customer: "cus_1" }))).toBeUndefined();
    }
  });
});
