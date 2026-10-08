import { boolean, mysqlTable, timestamp, tinyint, varchar } from "drizzle-orm/mysql-core";

/**
 * The site's own subscription — what the business pays monthly to keep the
 * online shop open (see src/lib/siteAccess.ts). One row, id 1: there is one
 * subscriber, so this is a singleton rather than a column on some tenant.
 *
 * Written only from Stripe (siteBilling.server.ts): the billing webhook, the
 * return from Checkout and the admin billing page all re-read the customer's
 * subscriptions and store the one that counts, so delivery order never matters.
 * `subscription_status` is Stripe's own word, unmapped — the access rule
 * decides what each one means.
 */
export const siteBilling = mysqlTable("site_billing", {
  id: tinyint("id").primaryKey(),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  subscriptionStatus: varchar("subscription_status", { length: 32 }),
  /** Cancelled in the billing portal: still paid up until current_period_end. */
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  currentPeriodEnd: timestamp("current_period_end"),
  /** While past_due: when the oldest unpaid invoice fell due — the shop closes PAST_DUE_GRACE_DAYS later. */
  pastDueSince: timestamp("past_due_since"),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});
