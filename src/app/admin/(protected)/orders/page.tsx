import Link from "next/link";
import { Search } from "lucide-react";

import OrderStatusBadge from "@/components/OrderStatusBadge";
import { customerHref } from "@/lib/adminCustomers";
import { parseSearch } from "@/lib/adminDashboard";
import { ORDER_LIST_LIMIT, adminListOrders } from "@/lib/adminOrders.server";
import { formatPence } from "@/lib/orderOfServicePricing";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, parseOrderStatus } from "@/lib/orders";

export const dynamic = "force-dynamic";

const formatDate = (date: Date | null) =>
  date
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date)
    : "—";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status: statusParam, q } = await searchParams;
  const status = parseOrderStatus(statusParam) ?? undefined;
  const query = parseSearch(q);
  const orders = await adminListOrders({ status, query });
  const filterHref = (candidate?: string) => {
    const params = new URLSearchParams();
    if (candidate) params.set("status", candidate);
    if (query) params.set("q", query);
    const search = params.toString();
    return search ? `/admin/orders?${search}` : "/admin/orders";
  };

  return (
    <>
      <h1 className="mb-2 font-display text-3xl font-medium text-primary">Orders</h1>
      <p className="mb-6 max-w-2xl font-body text-on-surface-variant">
        Paid orders, newest first. Open one to see its artwork, move it through
        production and see its history. Baskets that were never paid for are
        listed under “Draft”.
      </p>

      <form role="search" action="/admin/orders" className="mb-4 flex max-w-xl gap-2">
        {status && <input type="hidden" name="status" value={status} />}
        <label className="relative flex-1">
          <span className="sr-only">Search orders</span>
          <Search
            size={18}
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-label"
          />
          <input
            type="search"
            name="q"
            defaultValue={query ?? ""}
            placeholder="Order number, name, email, phone or postcode"
            className="field min-h-11 pl-10 text-base"
          />
        </label>
        <button type="submit" className="btn btn-primary min-h-11 px-5 text-base">
          Search
        </button>
      </form>

      <nav aria-label="Filter by status" className="mb-6 flex flex-wrap gap-2">
        <FilterLink href={filterHref()} active={!status}>
          {query ? "All" : "All paid"}
        </FilterLink>
        {ORDER_STATUSES.map((candidate) => (
          <FilterLink
            key={candidate}
            href={filterHref(candidate)}
            active={status === candidate}
          >
            {ORDER_STATUS_LABELS[candidate]}
          </FilterLink>
        ))}
      </nav>

      {query && (
        <p className="mb-4 font-body text-sm text-on-surface-variant" role="status">
          {orders.length === 0
            ? `No orders match “${query}”.`
            : `${orders.length}${orders.length === ORDER_LIST_LIMIT ? "+" : ""} ${orders.length === 1 ? "order matches" : "orders match"} “${query}”.`}{" "}
          <Link href={status ? `/admin/orders?status=${status}` : "/admin/orders"} className="link">
            Clear search
          </Link>
        </p>
      )}

      {!query && orders.length === ORDER_LIST_LIMIT && (
        <p className="mb-4 font-body text-sm text-on-surface-variant" role="status">
          Showing the {ORDER_LIST_LIMIT} most recent — search to find an older order.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-outline-variant/30 bg-surface-container-lowest ambient-shadow">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-outline-variant/40 font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary">
              <th className="px-5 py-3">Order</th>
              <th className="px-5 py-3">Placed</th>
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Products</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center font-body text-sm text-on-surface-variant">
                  {query ? "Nothing found — try part of the name, the email or the last digits of the order number." : "No orders here yet."}
                </td>
              </tr>
            )}
            {orders.map((order) => (
              <tr
                key={order.id}
                className="border-b border-outline-variant/20 font-body text-sm text-on-surface last:border-b-0"
              >
                <td className="px-5 py-3">
                  <Link href={`/admin/orders/${order.id}`} className="font-medium text-primary hover:underline">
                    {order.orderNumber}
                  </Link>
                </td>
                <td className="px-5 py-3 text-on-surface-variant">
                  {formatDate(order.placedAt ?? (order.status === "draft" ? order.createdAt : null))}
                </td>
                <td className="px-5 py-3">
                  {order.customerEmail ? (
                    <Link href={customerHref(order.customerEmail)} className="block font-medium hover:text-primary hover:underline">
                      {order.contactName ?? order.customerEmail}
                    </Link>
                  ) : (
                    <span className="block">{order.contactName ?? "—"}</span>
                  )}
                  <span className="block text-xs text-on-surface-variant">{order.contactEmail ?? ""}</span>
                </td>
                <td className="px-5 py-3 text-on-surface-variant">
                  {order.products.join(", ") || "—"}
                  {order.itemCount > order.products.length && (
                    <span className="block text-xs">{order.itemCount} items</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <OrderStatusBadge status={order.status} />
                </td>
                <td className="px-5 py-3 text-right">{formatPence(order.totalPence)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 font-body text-xs font-medium transition-colors duration-300 ${
        active
          ? "bg-primary-container text-white"
          : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
      }`}
    >
      {children}
    </Link>
  );
}
