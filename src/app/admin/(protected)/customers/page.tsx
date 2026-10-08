import Link from "next/link";
import { Search } from "lucide-react";

import { customerHref } from "@/lib/adminCustomers";
import { CUSTOMER_LIST_LIMIT, adminListCustomers } from "@/lib/adminCustomers.server";
import { parseSearch } from "@/lib/adminDashboard";
import { formatPence } from "@/lib/orderOfServicePricing";

export const dynamic = "force-dynamic";

const formatDate = (date: Date | null) =>
  date ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date) : "—";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = parseSearch(q);
  const { customers, total } = await adminListCustomers(query);

  return (
    <>
      <h1 className="mb-2 font-display text-3xl font-medium text-primary">Customers</h1>
      <p className="mb-6 max-w-2xl font-body text-on-surface-variant">
        Everyone who has paid for an order or made an account, most recent first. Most people order
        without an account, so a customer is their email address — open one to see all their orders.
      </p>

      <form role="search" action="/admin/customers" className="mb-6 flex max-w-xl gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Search customers</span>
          <Search
            size={18}
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-label"
          />
          <input
            type="search"
            name="q"
            defaultValue={query ?? ""}
            placeholder="Name, email, phone, postcode or order number"
            className="field min-h-11 pl-10 text-base"
          />
        </label>
        <button type="submit" className="btn btn-primary min-h-11 px-5 text-base">
          Search
        </button>
      </form>

      <p className="mb-4 font-body text-sm text-on-surface-variant" role="status">
        {query
          ? `${total} ${total === 1 ? "customer matches" : "customers match"} “${query}”. `
          : `${total} ${total === 1 ? "customer" : "customers"}. `}
        {total > CUSTOMER_LIST_LIMIT && `Showing the ${CUSTOMER_LIST_LIMIT} most recent — search to find others. `}
        {query && (
          <Link href="/admin/customers" className="link">
            Clear search
          </Link>
        )}
      </p>

      <div className="overflow-x-auto rounded-xl border border-outline-variant/30 bg-surface-container-lowest ambient-shadow">
        <table className="w-full min-w-[760px] text-left">
          <thead>
            <tr className="border-b border-outline-variant/40 font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary">
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Phone</th>
              <th className="px-5 py-3">Orders</th>
              <th className="px-5 py-3">Last order</th>
              <th className="px-5 py-3">Account</th>
              <th className="px-5 py-3 text-right">Spent, less refunds</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center font-body text-sm text-on-surface-variant">
                  {query ? "Nobody matches that — try part of the name or email." : "No customers yet."}
                </td>
              </tr>
            )}
            {customers.map((customer) => (
              <tr
                key={customer.email}
                className="border-b border-outline-variant/20 font-body text-sm text-on-surface last:border-b-0"
              >
                <td className="px-5 py-3">
                  <Link href={customerHref(customer.email)} className="block font-medium text-primary hover:underline">
                    {customer.name ?? customer.email}
                  </Link>
                  {customer.name && <span className="block text-xs text-on-surface-variant">{customer.email}</span>}
                </td>
                <td className="px-5 py-3 text-on-surface-variant">{customer.phone ?? "—"}</td>
                <td className="px-5 py-3 text-on-surface-variant">{customer.orderCount}</td>
                <td className="px-5 py-3 text-on-surface-variant">{formatDate(customer.lastOrderAt)}</td>
                <td className="px-5 py-3 text-on-surface-variant">
                  {customer.account ? `Since ${formatDate(customer.account.createdAt)}` : "Guest"}
                </td>
                <td className="px-5 py-3 text-right">{formatPence(customer.spentPence)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
