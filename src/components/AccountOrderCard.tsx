import Link from "next/link";
import { Check } from "lucide-react";

import OrderThumb from "@/components/OrderThumb";
import {
  ORDER_PROGRESS_STEPS,
  orderHeadline,
  orderTitle,
  progressState,
  serviceDateText,
} from "@/lib/accountOrders";
import type { OrderSummary } from "@/lib/orders.server";

/**
 * The order /account leads with: the newest one still on its way, how far
 * along it is, and a way into it. Nothing to approve — see accountOrders.ts.
 */
export default function AccountOrderCard({ order }: { order: OrderSummary }) {
  const headline = orderHeadline(order.status, order.paymentMethod);
  const spec = [
    orderTitle(order.lines),
    order.serviceDate && `Service on ${serviceDateText(order.serviceDate)}`,
  ].filter(Boolean);

  return (
    <section
      aria-labelledby="lead-order"
      className="overflow-hidden rounded-2xl border border-line bg-surface shadow-cover"
    >
      <div className="flex flex-wrap gap-x-10 gap-y-6 p-6 sm:p-10">
        <OrderThumb
          src={order.lines[0]?.previewImageUrl ?? null}
          className="h-[186px] w-[132px] shadow-cover"
          sizes="132px"
        />
        <div className="flex min-w-[260px] flex-1 flex-col gap-3">
          <p className="eyebrow text-plum">
            Order {order.orderNumber} · {headline.label}
          </p>
          <h2 id="lead-order" className="type-sub">
            {headline.title}
          </h2>
          <p className="text-ink-2">{headline.body}</p>
          <p className="text-base text-ink-3">{spec.join(" · ")}</p>
          <div className="pt-2">
            <Link href={`/orders/${order.id}`} className="btn btn-primary min-h-12 px-7">
              View order
            </Link>
          </div>
        </div>
      </div>
      <ol aria-label="Order progress" className="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-line bg-mist-2 px-6 py-5 sm:grid-cols-4 sm:px-10">
        {ORDER_PROGRESS_STEPS.map((label, index) => {
          const state = progressState(index, order.status);
          return (
            <li key={label} className="flex flex-col gap-3">
              <span aria-hidden className={`h-1 rounded-full ${state === "todo" ? "bg-line-2" : "bg-plum"}`} />
              <span
                className={`flex items-center gap-2.5 text-base ${
                  state === "current" ? "font-semibold text-ink" : state === "done" ? "text-ink" : "text-ink-3"
                }`}
              >
                <span
                  aria-hidden
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${
                    state === "done" ? "border-plum bg-plum text-white" : state === "current" ? "border-plum" : "border-line-2"
                  }`}
                >
                  {state === "done" && <Check size={14} strokeWidth={3} />}
                </span>
                {label}
                <span className="sr-only">{state === "done" ? " (done)" : state === "current" ? " (now)" : ""}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
