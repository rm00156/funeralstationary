import Link from "next/link";

import AdminTradeApplications, { type AdminTradeApplication } from "@/components/AdminTradeApplications";
import AdminTradeFirmForm from "@/components/AdminTradeFirmForm";
import { tradeDiscountText } from "@/lib/trade";
import { listTradeApplications, listTradeFirms, type TradeApplicationRow } from "@/lib/trade.server";

export const dynamic = "force-dynamic";

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);

const toClient = (row: TradeApplicationRow): AdminTradeApplication => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  decidedAt: row.decidedAt?.toISOString() ?? null,
});

/**
 * /admin/trade — applications from the /trade page waiting for a decision,
 * then the firms with trade accounts. Approving an application sets up its
 * firm and person; a firm can also be added by hand, and its people are
 * added by email on the firm's page.
 */
export default async function AdminTradePage() {
  const [firms, applications] = await Promise.all([listTradeFirms(), listTradeApplications()]);

  return (
    <>
      <h1 className="mb-2 font-display text-3xl font-medium text-primary">Trade accounts</h1>
      <p className="mb-8 max-w-2xl font-body text-on-surface-variant">
        Funeral directors and others who order for families. Approve an application below, or add a
        firm by hand and then each person&rsquo;s email on its page: when they sign in at My account with that address, they see the trade view
        and are asked for the family&rsquo;s name and their reference at checkout. Give a firm a trade
        discount and, once you trust them, let them order on account: Thintent then invoices each
        order on the firm&rsquo;s payment terms.
      </p>

      <AdminTradeApplications
        pending={applications.pending.map(toClient)}
        decided={applications.decided.map(toClient)}
        activeFirms={firms.filter((firm) => firm.isActive).map(({ id, name }) => ({ id, name }))}
      />

      <h2 className="mb-4 font-display text-2xl font-medium text-primary">Firms</h2>
      <AdminTradeFirmForm />

      {firms.length === 0 ? (
        <p className="font-body text-on-surface-variant">No trade firms yet.</p>
      ) : (
        // A narrow box gets a stacked card per firm rather than a table to scroll
        // sideways; a table once its own box (not the screen) is 48rem.
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest ambient-shadow @container overflow-x-auto">
          <table className="block w-full text-left @3xl:table @3xl:min-w-[640px]">
            <thead className="hidden @3xl:table-header-group">
              <tr className="border-b border-outline-variant/40 font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary">
                <th className="px-5 py-3">Firm</th>
                <th className="px-5 py-3">People</th>
                <th className="px-5 py-3">Orders</th>
                <th className="px-5 py-3">Terms</th>
                <th className="px-5 py-3">Discount</th>
                <th className="px-5 py-3">Added</th>
              </tr>
            </thead>
            <tbody className="block @3xl:table-row-group">
              {firms.map((firm) => (
                <tr
                  key={firm.id}
                  className="row-linked grid grid-cols-2 gap-x-4 gap-y-1 border-b border-outline-variant/20 px-5 py-4 font-body text-sm text-on-surface last:border-b-0 @3xl:table-row @3xl:p-0"
                >
                  <td className="col-span-2 @3xl:table-cell @3xl:px-5 @3xl:py-3">
                    <Link href={`/admin/trade/${firm.id}`} className="row-link link font-medium">
                      {firm.name}
                    </Link>
                    {!firm.isActive && (
                      <span className="ml-2 rounded-full bg-mist px-2.5 py-0.5 text-xs font-medium text-ink-2">
                        Retired
                      </span>
                    )}
                  </td>
                  <td className="@3xl:table-cell @3xl:px-5 @3xl:py-3">
                    <span className="text-on-surface-variant @3xl:hidden">People: </span>
                    {firm.memberCount}
                  </td>
                  <td className="@3xl:table-cell @3xl:px-5 @3xl:py-3">
                    <span className="text-on-surface-variant @3xl:hidden">Orders: </span>
                    {firm.orderCount}
                  </td>
                  <td className="text-on-surface-variant @3xl:table-cell @3xl:px-5 @3xl:py-3">
                    <span className="@3xl:hidden">Terms: </span>
                    {firm.paymentTermsDays === null ? "Not set" : `${firm.paymentTermsDays} days`}
                    {firm.onAccount && <span className="block text-xs">On account</span>}
                  </td>
                  <td className="text-on-surface-variant @3xl:table-cell @3xl:px-5 @3xl:py-3">
                    <span className="@3xl:hidden">Discount: </span>
                    {firm.discountPercent > 0 ? tradeDiscountText(firm.discountPercent) : "None"}
                  </td>
                  <td className="col-span-2 text-on-surface-variant @3xl:table-cell @3xl:px-5 @3xl:py-3">
                    <span className="@3xl:hidden">Added </span>
                    {formatDate(firm.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
