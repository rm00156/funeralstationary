import Link from "next/link";
import { LayoutTemplate, PenLine, Phone, Upload } from "lucide-react";

import SavedDesignList, { type SavedDesignSummary } from "@/components/SavedDesignList";
import SignOutButton from "@/components/SignOutButton";
import TradeOrdersTable from "@/components/TradeOrdersTable";
import type { OrderSummary } from "@/lib/orders.server";
import { DESIGN_FOR_YOU_HREF, PHONE_DISPLAY, PHONE_HREF, UPLOAD_DESIGN_HREF } from "@/lib/site";
import { shopDate } from "@/lib/adminDashboard";
import { formatPence } from "@/lib/orderOfServicePricing";
import {
  accountBalance,
  greeting,
  invoiceStatusText,
  longShopDate,
  tradeDiscountText,
  type TradeMembership,
} from "@/lib/trade";

/**
 * A trade account's /account: start an order for a family, the firm's orders
 * by family, and the trade line. Shown instead of CustomerAccount when the
 * signed-in email is on an active firm (trade.server.ts).
 *
 * A firm that orders on account also sees what it owes and its invoices,
 * which Thintent issues and reports back (orders.invoice_*). There are no
 * proofs to approve: there is no proof loop (designs are checked before they
 * can be ordered).
 */
export default function TradeAccount({
  membership,
  email,
  designCount,
  designs,
  orders,
  now,
}: {
  membership: TradeMembership;
  email: string;
  /** Published designs across the shop, for "Pick from our N designs". */
  designCount: number;
  designs: SavedDesignSummary[];
  orders: OrderSummary[];
  now: Date;
}) {
  const today = shopDate(now);
  const accountOrders = orders.filter((order) => order.paymentMethod === "account");
  const balance = accountBalance(orders, today);
  const showAccount = membership.onAccount || accountOrders.length > 0;
  // Unpaid first (oldest due first), then the latest settled ones.
  const invoiceRows = [
    ...accountOrders
      .filter((order) => order.invoice?.status !== "paid" && order.invoice?.status !== "voided" && order.status !== "cancelled")
      .sort((a, b) => (a.invoice?.dueDate ?? "9999").localeCompare(b.invoice?.dueDate ?? "9999")),
    ...accountOrders.filter(
      (order) => order.invoice?.status === "paid" || order.invoice?.status === "voided" || order.status === "cancelled",
    ),
  ].slice(0, 8);

  const startCards = [
    {
      href: "/shop",
      icon: LayoutTemplate,
      title: "Use a template",
      body: `Pick from our ${designCount} designs and personalise it.`,
    },
    { href: UPLOAD_DESIGN_HREF, icon: Upload, title: "Upload a design", body: "Send a PDF or a Canva link." },
    {
      href: DESIGN_FOR_YOU_HREF,
      icon: PenLine,
      title: "Have us design it",
      body: "Send the family’s photos and words.",
    },
  ];

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-1">
          <p className="text-ink-2">{longShopDate(now)}</p>
          <h1 className="type-page">
            {greeting(now)}
            {membership.memberName ? `, ${membership.memberName}` : ""}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-surface px-5 py-3.5 text-base text-ink-2">
          <p className="flex items-center gap-3">
            <span className="rounded-full bg-plum-night px-2.5 py-0.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-white">
              Trade
            </span>
            <strong className="font-semibold text-ink">{membership.firmName}</strong>
          </p>
          {membership.discountPercent > 0 && (
            <p className="border-l border-line pl-4">{tradeDiscountText(membership.discountPercent)} print</p>
          )}
          {showAccount && (
            <p className="border-l border-line pl-4">
              On account <strong className="font-semibold text-ink tabular-nums">{formatPence(balance.owedPence)}</strong>
            </p>
          )}
        </div>
      </div>

      <section aria-labelledby="trade-start" className="flex flex-col gap-4">
        <h2 id="trade-start" className="eyebrow">
          Start an order for a family
        </h2>
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-5">
          {startCards.map((card) => (
            <li key={card.href}>
              <Link
                href={card.href}
                className="flex h-full gap-4 rounded-xl border border-line bg-surface p-6 no-underline transition-colors hover:border-plum"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-mist text-plum">
                  <card.icon size={22} strokeWidth={1.7} aria-hidden />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-lg font-semibold text-ink">{card.title}</span>
                  <span className="text-base text-ink-2">{card.body}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-10">
          <TradeOrdersTable
            orders={orders.map((order) => ({
              id: order.id,
              orderNumber: order.orderNumber,
              status: order.status,
              familyName: order.familyName,
              customerRef: order.customerRef,
              serviceDate: order.serviceDate,
              lines: order.lines.map(({ productLabel, copies }) => ({ productLabel, copies })),
            }))}
          />
          <section aria-labelledby="trade-designs" className="flex flex-col gap-5">
            <h2 id="trade-designs" className="font-display text-[28px] font-normal text-ink">
              Designs in progress
            </h2>
            <SavedDesignList initialDesigns={designs} />
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          {showAccount && (
            <section aria-labelledby="trade-invoices" className="flex flex-col rounded-xl border border-line bg-surface p-7">
              <h2 id="trade-invoices" className="font-display text-2xl font-normal text-ink">
                Invoices
              </h2>
              <p className="mt-2 text-base text-ink-2">
                {membership.onAccount && membership.paymentTermsDays !== null
                  ? `Orders on account are invoiced by email; payment is due ${membership.paymentTermsDays} days after each invoice.`
                  : "Your orders placed on account."}
              </p>
              {balance.overduePence > 0 && (
                <p className="mt-3 rounded-lg bg-warn-bg px-3.5 py-2.5 text-base font-medium text-warn-text">
                  {formatPence(balance.overduePence)} overdue on {balance.overdueCount}{" "}
                  {balance.overdueCount === 1 ? "invoice" : "invoices"}
                </p>
              )}
              {invoiceRows.length === 0 ? (
                <p className="mt-4 border-t border-line pt-4 text-base text-ink-3">No invoices yet.</p>
              ) : (
                <ul className="mt-4 flex flex-col">
                  {invoiceRows.map((order) => (
                    <li key={order.id} className="flex items-start justify-between gap-3 border-t border-line py-3 text-base">
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink">
                          {order.familyName ?? order.orderNumber}
                        </span>
                        <span className="block text-[15px] text-ink-3">{invoiceStatusText(order, today)}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end">
                        <span className="tabular-nums text-ink">{formatPence(order.totalPence)}</span>
                        {order.invoice?.url && (
                          <a href={order.invoice.url} target="_blank" rel="noopener noreferrer" className="link text-[15px]">
                            {order.invoice.status === "paid" ? "Receipt" : "View or pay"}
                            <span className="sr-only"> the invoice for {order.familyName ?? order.orderNumber} (opens in a new tab)</span>
                          </a>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          <section className="flex flex-col rounded-xl border border-line bg-surface p-7">
            <h2 className="mb-3 font-display text-2xl font-normal text-ink">Your account</h2>
            <p className="border-t border-line py-3 text-base text-ink-2">
              <span className="block font-medium text-ink">{membership.firmName}</span>
              <span className="[overflow-wrap:anywhere]">{email}</span>
            </p>
            <Link href="/cart" className="link flex min-h-12 items-center border-t border-line text-base">
              Your basket
            </Link>
            <div className="flex min-h-12 items-center border-t border-line">
              <SignOutButton className="min-h-11 text-base" />
            </div>
          </section>
          <section className="flex flex-col gap-3 rounded-xl bg-plum-night p-7 text-on-plum">
            <h2 className="font-display text-2xl font-normal text-white">Need it faster?</h2>
            <p className="text-base">Call the trade line and we’ll tell you exactly what’s possible.</p>
            <a
              href={PHONE_HREF}
              className="flex min-h-11 items-center gap-2.5 self-start text-[22px] font-semibold text-white no-underline hover:underline"
            >
              <Phone size={20} strokeWidth={1.8} aria-hidden />
              {PHONE_DISPLAY}
            </a>
          </section>
        </aside>
      </div>
    </div>
  );
}
