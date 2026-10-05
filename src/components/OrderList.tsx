import Link from "next/link";
import { ChevronRight, Package } from "lucide-react";

import OrderStatusBadge from "@/components/OrderStatusBadge";
import { formatPence } from "@/lib/orderOfServicePricing";
import type { OrderSummary } from "@/lib/orders.server";

const formatDate = (date: Date | null) =>
  date
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(date)
    : "—";

/** The placed orders on the account page. */
export default function OrderList({ orders }: { orders: OrderSummary[] }) {
  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-10 text-center">
        <Package size={28} className="mx-auto mb-4 text-on-surface-variant" aria-hidden />
        <p className="font-body text-base text-on-surface-variant">
          You have not placed an order yet.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {orders.map((order) => (
        <li key={order.id}>
          <Link
            href={`/orders/${order.id}`}
            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 transition-colors hover:border-primary-container/60"
          >
            <div>
              <h3 className="font-display text-xl font-medium text-on-surface">
                {order.orderNumber}
              </h3>
              <p className="font-body text-sm text-on-surface-variant">
                Placed {formatDate(order.placedAt)} · {order.itemCount}{" "}
                {order.itemCount === 1 ? "item" : "items"}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <OrderStatusBadge status={order.status} />
              <span className="font-display text-xl text-primary">
                {formatPence(order.totalPence)}
              </span>
              <ChevronRight size={18} aria-hidden className="text-outline" />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
