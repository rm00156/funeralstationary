"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Search } from "lucide-react";

import { itemsSummary, serviceDateText } from "@/lib/accountOrders";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/orders";
import {
  TRADE_ORDER_TABS,
  filterTradeOrders,
  tradeTabCounts,
  type TradeOrderTab,
} from "@/lib/trade";

export interface TradeOrderRow {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  familyName: string | null;
  customerRef: string | null;
  serviceDate: string | null;
  lines: { productLabel: string; copies: number }[];
}

/** Status pills in the handoff's palette: in hand, at the printer, done, stopped. */
const STATUS_PILL: Record<OrderStatus, string> = {
  draft: "bg-mist text-ink-2",
  awaiting_print: "bg-mist-3 text-plum-deep",
  in_production: "bg-success-bg text-success-text",
  shipped: "bg-success-bg text-success-text",
  delivered: "bg-mist text-ink-2",
  cancelled: "bg-mist text-ink-3",
  refunded: "bg-mist text-ink-3",
};

/** Plainer than the admin's wording: a funeral director wants to know where it is. */
const STATUS_TEXT: Partial<Record<OrderStatus, string>> = {
  awaiting_print: "Ordered",
  in_production: "Printing",
  shipped: "On its way",
};

/**
 * A firm's orders on its trade account: searchable by family, reference or
 * order number, with tabs for what's under way and what's delivered
 * (trade.ts holds the rules). Filtering happens here, in memory — an
 * account's order list is small.
 */
export default function TradeOrdersTable({ orders }: { orders: TradeOrderRow[] }) {
  const [tab, setTab] = useState<TradeOrderTab>("all");
  const [query, setQuery] = useState("");
  const searchId = useId();
  const counts = tradeTabCounts(orders);
  const shown = filterTradeOrders(orders, tab, query);

  return (
    <section aria-labelledby="trade-orders" className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 pb-4 pt-6 sm:px-7">
        <h2 id="trade-orders" className="font-display text-[28px] font-normal text-ink">
          Your orders
        </h2>
        <label htmlFor={searchId} className="relative w-full sm:w-[340px]">
          <span className="sr-only">Search by family name, your reference or order number</span>
          <Search
            size={18}
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-label"
          />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Family name or your reference"
            className="field min-h-12 pl-10 text-base"
          />
        </label>
      </div>

      <div role="group" aria-label="Show orders" className="flex gap-6 overflow-x-auto border-y border-line px-6 sm:px-7">
        {TRADE_ORDER_TABS.map((option) => {
          const selected = tab === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setTab(option.id)}
              className={`flex min-h-12 shrink-0 cursor-pointer items-center gap-2 border-b-2 text-base transition-colors ${
                selected ? "border-plum font-semibold text-ink" : "border-transparent text-ink-2 hover:text-plum"
              }`}
            >
              {option.label}
              <span
                className={`rounded-full px-2.5 text-[13px] font-semibold ${
                  selected ? "bg-plum text-white" : "bg-mist text-ink-2"
                }`}
              >
                {counts[option.id]}
              </span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p role="status" className="px-6 py-10 text-center text-ink-2 sm:px-7">
          {orders.length === 0
            ? "You haven’t placed an order yet. Start one for a family above."
            : query
              ? `No orders match “${query.trim()}”.`
              : "No orders here."}
        </p>
      ) : (
        // A narrow box gets a stacked card per order (family and View on top, the
        // rest beneath) rather than a table to scroll sideways; a table once its own box (not the screen) is 48rem.
        <div className="@container overflow-x-auto">
          <table className="block w-full text-left text-base @3xl:table @3xl:min-w-[720px]">
            <thead className="hidden bg-mist-2 text-[15px] font-semibold text-ink @3xl:table-header-group">
              <tr>
                <th scope="col" className="px-6 py-3.5 sm:pl-7">Family</th>
                <th scope="col" className="px-3 py-3.5">Your ref</th>
                <th scope="col" className="px-3 py-3.5">Order</th>
                <th scope="col" className="px-3 py-3.5">Service</th>
                <th scope="col" className="px-3 py-3.5">Status</th>
                <th scope="col" className="px-6 py-3.5 sm:pr-7">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className="block @3xl:table-row-group">
              {shown.map((order) => (
                <tr
                  key={order.id}
                  className="row-linked grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 border-t border-line px-6 py-5 first:border-t-0 sm:px-7 @3xl:table-row @3xl:p-0 @3xl:align-middle @3xl:first:border-t"
                >
                  <td className="col-start-1 font-semibold text-ink @3xl:table-cell @3xl:px-6 @3xl:py-4 @3xl:pl-7">
                    {order.familyName ?? <span className="font-normal text-ink-3">Not given</span>}
                  </td>
                  <td
                    className={`col-start-1 text-ink-2 @3xl:table-cell @3xl:px-3 @3xl:py-4 ${order.customerRef ? "" : "hidden"}`}
                  >
                    <span className="@3xl:hidden">Your ref </span>
                    {order.customerRef ?? "—"}
                  </td>
                  <td className="col-start-1 @3xl:table-cell @3xl:px-3 @3xl:py-4">
                    {itemsSummary(order.lines)}
                    <span className="block text-[15px] text-ink-3">{order.orderNumber}</span>
                  </td>
                  <td
                    className={`col-start-1 text-ink-2 @3xl:table-cell @3xl:whitespace-nowrap @3xl:px-3 @3xl:py-4 ${order.serviceDate ? "" : "hidden"}`}
                  >
                    <span className="@3xl:hidden">Service </span>
                    {order.serviceDate ? serviceDateText(order.serviceDate, "short") : "—"}
                  </td>
                  <td className="col-start-1 pt-1 @3xl:table-cell @3xl:px-3 @3xl:py-4">
                    <span
                      className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-[14px] font-semibold ${STATUS_PILL[order.status]}`}
                    >
                      {STATUS_TEXT[order.status] ?? ORDER_STATUS_LABELS[order.status]}
                    </span>
                  </td>
                  <td className="col-start-2 row-start-1 @3xl:table-cell @3xl:px-6 @3xl:py-4 @3xl:pr-7 @3xl:text-right">
                    <Link
                      href={`/orders/${order.id}`}
                      className="row-link btn btn-outline min-h-11 px-4 text-base"
                      aria-label={`View order ${order.orderNumber}${order.familyName ? ` for ${order.familyName}` : ""}`}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
