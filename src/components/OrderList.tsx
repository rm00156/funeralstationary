import Link from "next/link";

import OrderThumb from "@/components/OrderThumb";
import { orderHeadline, orderTitle, shortDate } from "@/lib/accountOrders";
import type { OrderSummary } from "@/lib/orders.server";

/** Orders held by this browser, on a guest's /account. Signed in, CustomerAccount lists them. */
export default function OrderList({ orders }: { orders: OrderSummary[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {orders.map((order) => (
        <li
          key={order.id}
          className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-xl border border-line bg-surface p-5 sm:px-7"
        >
          <OrderThumb src={order.lines[0]?.previewImageUrl ?? null} />
          <div className="flex min-w-[200px] flex-1 flex-col gap-0.5">
            <h3 className="text-lg font-semibold text-ink">{orderTitle(order.lines)}</h3>
            <p className="text-base text-ink-2">
              Order {order.orderNumber} · {orderHeadline(order.status).label}
              {order.placedAt && ` · placed ${shortDate(order.placedAt)}`}
            </p>
          </div>
          <Link href={`/orders/${order.id}`} className="btn btn-outline min-h-12 px-6">
            View order
          </Link>
        </li>
      ))}
    </ul>
  );
}
