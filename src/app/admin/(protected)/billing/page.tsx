import { formatPence } from "@/lib/orderOfServicePricing";
import { formatBillingDate, type SiteAccess, type SiteAccessReason } from "@/lib/siteAccess";
import { billingConfigured, getSiteAccess, getSubscriptionPrice } from "@/lib/siteBilling.server";

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

const BUTTON =
  "rounded-lg bg-primary-container px-5 py-3 font-body font-medium text-white transition-colors duration-300 hover:bg-primary";
const OUTLINE_BUTTON =
  "rounded-lg border border-outline-variant px-5 py-3 font-body font-medium text-primary transition-colors duration-300 hover:bg-surface-container";

/**
 * The site's own subscription — what keeps the online shop open (see
 * src/lib/siteAccess.ts). Subscribing and managing both happen on Stripe's
 * hosted pages; they come back through /api/admin/billing/return, which
 * re-reads the subscription before landing here.
 */
export default async function AdminBillingPage({ searchParams }: PageProps<"/admin/billing">) {
  const { subscribed, error } = await searchParams;
  const [access, price] = await Promise.all([getSiteAccess(), getSubscriptionPrice()]);
  const configured = billingConfigured();
  // An overdue subscription is settled in the portal, not replaced by a second one.
  const canSubscribe = !access.entitled && access.reason !== "overdue";

  return (
    <>
      <h1 className="mb-8 font-display text-3xl font-medium text-primary">Billing</h1>

      {typeof error === "string" && (
        <p role="alert" className="mb-6 rounded-lg bg-warn-bg px-4 py-3 font-body text-warn-text">
          {error}
        </p>
      )}
      {subscribed === "1" && access.entitled && (
        <p role="status" className="mb-6 rounded-lg bg-surface-container px-4 py-3 font-body text-on-surface">
          Thank you — the subscription is set up.
        </p>
      )}

      <section className="max-w-[720px] rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 ambient-shadow md:p-8">
        <p className="font-body text-sm uppercase tracking-wide text-on-surface-variant">Website subscription</p>
        <h2 className="mt-2 font-display text-2xl text-on-surface">{STATUS[access.reason]}</h2>
        <p className="mt-3 font-body text-on-surface-variant">{detail(access)}</p>
        {price && (
          <p className="mt-4 font-body text-on-surface">
            <span className="font-display text-xl">{formatPence(price.amountPence)}</span> a {price.interval}
          </p>
        )}

        <p className="mt-6 border-t border-outline-variant/30 pt-6 font-body text-on-surface-variant">
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
                <button type="submit" className={BUTTON}>
                  {access.reason === "never_subscribed" ? "Subscribe" : "Subscribe again"}
                </button>
              </form>
            )}
            {access.reason !== "never_subscribed" && (
              <form action="/api/admin/billing/portal" method="post">
                <button type="submit" className={canSubscribe ? OUTLINE_BUTTON : BUTTON}>
                  Manage billing
                </button>
              </form>
            )}
          </div>
        ) : (
          <p className="mt-6 font-body text-sm text-on-surface-variant">
            Online billing isn’t set up on this site yet.
          </p>
        )}
        {configured && (
          <p className="mt-4 font-body text-sm text-on-surface-variant">
            Payments, card changes, cancelling and invoices are handled securely by Stripe.
          </p>
        )}
      </section>
    </>
  );
}
