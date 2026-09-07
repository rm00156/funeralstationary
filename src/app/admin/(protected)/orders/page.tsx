import Link from "next/link";

import OrderStatusBadge from "@/components/OrderStatusBadge";
import { adminListOrders } from "@/lib/adminOrders.server";
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
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusParam } = await searchParams;
  const status = parseOrderStatus(statusParam) ?? undefined;
  const orders = await adminListOrders({ status });

  return (
    <>
      <h1 className="mb-2 font-display text-3xl font-semibold text-primary">Orders</h1>
      <p className="mb-6 max-w-2xl font-body text-on-surface-variant">
        Paid orders, newest first. Open one to send its proof, move it through
        production and see its history. Baskets that were never paid for are
        listed under “Draft”.
      </p>

      <nav aria-label="Filter by status" className="mb-6 flex flex-wrap gap-2">
        <FilterLink href="/admin/orders" active={!status}>
          All open
        </FilterLink>
        {ORDER_STATUSES.map((candidate) => (
          <FilterLink
            key={candidate}
            href={`/admin/orders?status=${candidate}`}
            active={status === candidate}
          >
            {ORDER_STATUS_LABELS[candidate]}
          </FilterLink>
        ))}
      </nav>

      <div className="overflow-x-auto rounded-xl border border-outline-variant/30 bg-surface-container-lowest ambient-shadow">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-outline-variant/40 font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary">
              <th className="px-5 py-3">Order</th>
              <th className="px-5 py-3">Placed</th>
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Items</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center font-body text-sm text-on-surface-variant">
                  No orders here yet.
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
                  <span className="block">{order.contactName ?? "—"}</span>
                  <span className="block text-xs text-on-surface-variant">{order.contactEmail ?? ""}</span>
                </td>
                <td className="px-5 py-3 text-on-surface-variant">{order.itemCount}</td>
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
