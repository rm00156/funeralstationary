import { formatPence } from "@/lib/orderOfServicePricing";
import { formatBillingDate, type SiteAccess, type SiteAccessReason } from "@/lib/siteAccess";
import {
  billingConfigured,
  getSubscriptionPrice,
  readSiteAccess,
  syncSiteSubscription,
} from "@/lib/siteBilling.server";

export const dynamic = "force-dynamic";

const STATUS: Record<SiteAccessReason, string> = {
  subscribed: "Subscribed",
  cancelling: "Cancelled",
  past_due: "Payment failed",
  overdue: "Payment overdue",
  incomplete: "Payment not finished",
  never_subscribed: "Not subscribed",
  lapsed: "Subscription ended",
};

function detail(access: SiteAccess): string {
  const until = access.currentPeriodEnd ? formatBillingDate(access.currentPeriodEnd) : null;
  switch (access.reason) {
    case "subscribed":
      return until ? `Thank you. The next payment is taken on ${until}.` : "Thank you — you’re all set.";
    case "cancelling":
      return until
        ? `It stays active until ${until}. To keep it going, choose “Manage billing” and renew it.`
        : "It stays active until the end of the period already paid for.";
    case "past_due":
      return access.closesAt
        ? `Stripe will try the card again over the next few days. Update the card in “Manage billing” to settle it — otherwise the online shop closes on ${formatBillingDate(access.closesAt)}.`
        : "Stripe will try the card again over the next few days. Update the card in “Manage billing” to settle it.";
    case "overdue":
      return "The last payment still hasn’t gone through, so the online shop has closed. Update the card in “Manage billing” to pay it and reopen the shop.";
    case "incomplete":
      return "The first payment wasn’t completed (the bank may have asked for a check). Please subscribe again.";
    case "never_subscribed":
      return "Subscribe to keep the online shop open for your customers.";
    case "lapsed":
      return "Subscribe again to reopen the online shop.";
  }
}

/**
 * The site's own subscription — what keeps the online shop open (see
 * src/lib/siteAccess.ts). Subscribing and managing both happen on Stripe's
 * hosted pages; they come back through /api/admin/billing/return, which
 * re-reads the subscription before landing here. Opening the page re-reads it
 * too, so a missed webhook is put right by looking.
 */
export default async function AdminBillingPage({ searchParams }: PageProps<"/admin/billing">) {
  const { subscribed, error } = await searchParams;
  try {
    await syncSiteSubscription();
  } catch (error) {
    // Stripe unreachable: show what's stored rather than no page at all.
    console.error("Billing: couldn't sync the subscription on the billing page", error);
  }
  // Read now, not request-cached: the layout may already have read the row before the sync.
  const [access, price] = await Promise.all([readSiteAccess(), getSubscriptionPrice()]);
  const configured = billingConfigured();
  // An overdue subscription is settled in the portal, not replaced by a second one.
  const canSubscribe = !access.entitled && access.reason !== "overdue";

  return (
    <>
      <h1 className="mb-8 font-display text-3xl font-medium text-plum">Billing</h1>

      {typeof error === "string" && (
        <p role="alert" className="mb-6 rounded-lg bg-warn-bg px-4 py-3 font-body text-warn-text">
          {error}
        </p>
      )}
      {subscribed === "1" && access.entitled && (
        <p role="status" className="mb-6 rounded-lg border border-success-border bg-success-bg px-4 py-3 font-body text-success-text">
          Thank you — the subscription is set up.
        </p>
      )}

      <section className="max-w-[720px] rounded-xl border border-line bg-surface p-6 shadow-cover md:p-8">
        <p className="eyebrow">Website subscription</p>
        <h2 className="mt-2 font-display text-2xl text-ink">{STATUS[access.reason]}</h2>
        <p className="mt-3 font-body text-ink-2">{detail(access)}</p>
        {price && (
          <p className="mt-4 font-body text-ink">
            <span className="font-display text-xl">{formatPence(price.amountPence)}</span> a {price.interval}
          </p>
        )}

        <p className="mt-6 border-t border-line pt-6 font-body text-ink-2">
          {!access.required
            ? "The online shop is open."
            : access.open
              ? "The online shop is open: customers can design, upload and order."
              : "The online shop is closed: customers can look at the designs but can’t design, upload or order. Orders already paid for still go to print."}
        </p>

        {configured ? (
          <div className="mt-6 flex flex-wrap gap-3">
            {canSubscribe && (
              <form action="/api/admin/billing/checkout" method="post">
                <button type="submit" className="btn btn-primary">
                  {access.reason === "never_subscribed" ? "Subscribe" : "Subscribe again"}
                </button>
              </form>
            )}
            {access.reason !== "never_subscribed" && (
              <form action="/api/admin/billing/portal" method="post">
                <button type="submit" className={canSubscribe ? "btn btn-outline" : "btn btn-primary"}>
                  Manage billing
                </button>
              </form>
            )}
          </div>
        ) : (
          <p className="mt-6 font-body text-sm text-ink-3">
            Online billing isn’t set up on this site yet.
          </p>
        )}
        {configured && (
          <p className="mt-4 font-body text-sm text-ink-3">
            Payments, card changes, cancelling and invoices are handled securely by Stripe.
          </p>
        )}
      </section>
    </>
  );
}
