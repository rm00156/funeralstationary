import Link from "next/link";
import { ArrowUpRight, Check, Clock, Search } from "lucide-react";

import AdminTakingsChart from "@/components/AdminTakingsChart";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import { customerHref } from "@/lib/adminCustomers";
import {
  OPEN_STATUSES,
  actionItems,
  changeText,
  customerName,
  cutoffState,
  durationText,
  mustGoOutToday,
  serviceUrgency,
  shopDate,
  SHOP_TIME_ZONE,
  type DashboardLine,
  type Urgency,
} from "@/lib/adminDashboard";
import {
  adminOrderCounts,
  loadCatalogueCounts,
  loadProductSales,
  loadTakings,
  loadWorkingOrders,
} from "@/lib/adminDashboard.server";
import { copiesText, formatPence } from "@/lib/orderOfServicePricing";
import { ORDER_CUTOFF } from "@/lib/site";
import { isThintentConfigured } from "@/lib/thintent.server";

export const dynamic = "force-dynamic";

const URGENCY_STYLES: Record<Urgency, string> = {
  now: "bg-block-bg text-block-text",
  soon: "bg-warn-bg text-warn-text",
  later: "bg-mist text-ink-2",
  none: "bg-mist text-ink-label",
};

const CARD = "rounded-xl border border-line bg-surface ambient-shadow";

/** "Today 08:12", "Yesterday", "Tue", "2 Oct" — when an order came in, in shop time. */
function placedText(date: Date | null, now: Date): string {
  if (!date) return "—";
  const day = shopDate(date);
  const today = shopDate(now);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: SHOP_TIME_ZONE });
  if (day === today) return `Today ${time.format(date)}`;
  const age = (new Date(`${today}T00:00:00Z`).getTime() - new Date(`${day}T00:00:00Z`).getTime()) / 86_400_000;
  if (age === 1) return "Yesterday";
  const format =
    age < 7
      ? { weekday: "short" as const }
      : { day: "numeric" as const, month: "short" as const };
  return new Intl.DateTimeFormat("en-GB", { ...format, timeZone: SHOP_TIME_ZONE }).format(date);
}

function designFrom(lines: DashboardLine[]): string {
  const sources = [
    ...new Set(
      lines.map((line) =>
        line.source === "pdf" ? "PDF upload" : line.source === "canva" ? "Canva link" : `Template: ${line.templateName ?? "—"}`,
      ),
    ),
  ];
  return sources.join(", ");
}

function ServiceChip({ label, urgency }: { label: string; urgency: Urgency }) {
  return (
    <span className={`inline-block rounded-md px-2.5 py-1 font-body text-xs font-semibold ${URGENCY_STYLES[urgency]}`}>
      {label}
    </span>
  );
}

export default async function AdminTodayPage() {
  const now = new Date();
  const [counts, working, takings, sales, catalogue] = await Promise.all([
    adminOrderCounts(),
    loadWorkingOrders(now),
    loadTakings(now),
    loadProductSales(now),
    loadCatalogueCounts(),
  ]);

  const today = shopDate(now);
  const actions = actionItems(working, { now, thintentConfigured: isThintentConfigured() });
  const dispatch = mustGoOutToday(working, now);
  const dispatched = dispatch.filter((row) => row.sent).length;
  const sentToday = working.filter(
    (order) => order.status === "shipped" && order.shippedAt && shopDate(order.shippedAt) === today,
  ).length;
  const openOrders = working
    .filter((order) => OPEN_STATUSES.includes(order.status))
    .sort(
      (a, b) =>
        (a.serviceDate ?? "9999").localeCompare(b.serviceDate ?? "9999") ||
        (a.paidAt?.getTime() ?? 0) - (b.paidAt?.getTime() ?? 0),
    );
  const cutoff = cutoffState(now, ORDER_CUTOFF);
  const monthChange = changeText(takings.month.netPence, takings.lastMonthToDate.netPence);
  const heading = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: SHOP_TIME_ZONE,
  }).format(now);

  const tiles = [
    { label: "Needs you", value: actions.length, note: "Below, most urgent first", dot: "bg-warn-text", href: "#needs-you" },
    { label: "To print", value: counts.awaiting_print, note: "Paid, not printed", dot: "bg-plum", href: "/admin/orders?status=awaiting_print" },
    { label: "Printing", value: counts.in_production, note: "In production", dot: "bg-star", href: "/admin/orders?status=in_production" },
    { label: "Sent today", value: sentToday, note: "With the courier", dot: "bg-ink-label", href: "/admin/orders?status=shipped" },
  ];

  return (
    <div className="font-body text-ink">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-2">{heading}</p>
          <h1 className="font-display text-5xl leading-tight text-ink">Today</h1>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 md:w-auto">
          <p className={`${CARD} flex min-h-11 items-center gap-2 px-4 text-sm`}>
            <Clock size={16} aria-hidden className="text-plum" />
            {cutoff.kind === "open" ? (
              <span>
                Next-day cut-off <strong>{ORDER_CUTOFF}</strong> · {durationText(cutoff.minutesLeft)} left
              </span>
            ) : cutoff.kind === "passed" ? (
              <span>
                Next-day cut-off <strong>{ORDER_CUTOFF}</strong> has passed
              </span>
            ) : (
              <span>No courier collection today</span>
            )}
          </p>
          <form role="search" action="/admin/orders" className="relative min-w-0 flex-1 md:w-72 md:flex-none">
            <label htmlFor="today-search" className="sr-only">
              Search orders
            </label>
            <Search
              size={18}
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-label"
            />
            <input
              id="today-search"
              type="search"
              name="q"
              placeholder="Order no., name or email"
              className="field min-h-11 pl-10 text-base"
            />
          </form>
        </div>
      </header>

      <h2 className="eyebrow mb-3">Production</h2>
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Link key={tile.label} href={tile.href} className={`${CARD} block p-5 transition-colors hover:border-line-2`}>
            <span className="flex items-center gap-2 text-sm font-semibold">
              <span aria-hidden className={`size-2.5 rounded-full ${tile.dot}`} />
              {tile.label}
            </span>
            <span className="mt-1 block font-display text-4xl leading-tight">{tile.value}</span>
            <span className="block text-sm text-ink-2">{tile.note}</span>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section id="needs-you" className={`${CARD} scroll-mt-6`}>
            <div className="flex items-baseline justify-between gap-4 border-b border-line px-6 py-5">
              <h2 className="font-display text-2xl">Needs you now</h2>
              <span className="text-sm text-ink-2">Most urgent first</span>
            </div>
            {actions.length === 0 ? (
              <p className="px-6 py-6 text-ink-2">Nothing needs you right now.</p>
            ) : (
              <ul className="divide-y divide-line">
                {actions.map((item) => (
                  <li key={item.orderId} className="flex flex-wrap items-center gap-4 px-6 py-4 sm:flex-nowrap">
                    <div className="w-32 shrink-0">
                      <ServiceChip {...item.chip} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p>
                        <Link href={`/admin/orders/${item.orderId}`} className="font-semibold hover:underline">
                          {item.orderNumber}
                        </Link>{" "}
                        · <span className="font-semibold">{item.customer}</span>{" "}
                        <span className="text-ink-2">· {item.product}</span>
                      </p>
                      <p className="text-sm text-ink-2">{item.message}</p>
                    </div>
                    {item.external ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`btn ${item.emphasis === "primary" ? "btn-primary" : "btn-outline"} min-h-11 shrink-0 px-4 text-sm`}
                      >
                        {item.action}
                        <ArrowUpRight size={14} aria-hidden />
                      </a>
                    ) : (
                      <Link
                        href={item.href}
                        className={`btn ${item.emphasis === "primary" ? "btn-primary" : "btn-outline"} min-h-11 shrink-0 px-4 text-sm`}
                      >
                        {item.action}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={`${CARD} overflow-hidden`}>
            <div className="flex items-baseline justify-between gap-4 px-6 py-5">
              <h2 className="font-display text-2xl">Open orders</h2>
              <Link href="/admin/orders" className="link text-sm">
                All orders
              </Link>
            </div>
            {openOrders.length === 0 ? (
              <p className="border-t border-line px-6 py-6 text-ink-2">Everything paid for has been sent.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="bg-mist-2">
                    <tr className="border-y border-line font-semibold text-ink-2">
                      <th className="px-6 py-3">Order</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Design from</th>
                      <th className="px-4 py-3">Service</th>
                      <th className="px-4 py-3">Stage</th>
                      <th className="px-6 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {openOrders.map((order) => {
                      const chip = serviceUrgency(order.serviceDate, today);
                      return (
                        <tr key={order.id} className="align-top">
                          <td className="px-6 py-3">
                            <Link href={`/admin/orders/${order.id}`} className="link font-semibold">
                              {order.orderNumber}
                            </Link>
                            <span className="block text-ink-2">{placedText(order.paidAt, now)}</span>
                          </td>
                          <td className="px-4 py-3">
                            {order.customerEmail ? (
                              <Link href={customerHref(order.customerEmail)} className="hover:underline">
                                {customerName(order)}
                              </Link>
                            ) : (
                              customerName(order)
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {order.lines.map((line, index) => (
                              <span key={index} className="block">
                                {line.productLabel}
                                <span className="block text-ink-2">
                                  {copiesText(line.copies)} · {line.pagesLabel}
                                </span>
                              </span>
                            ))}
                          </td>
                          <td className="px-4 py-3">{designFrom(order.lines)}</td>
                          <td className="px-4 py-3">
                            {order.serviceDate ? <ServiceChip {...chip} /> : <span className="text-ink-2">Not given</span>}
                          </td>
                          <td className="px-4 py-3">
                            <OrderStatusBadge status={order.status} />
                          </td>
                          <td className="px-6 py-3 text-right">{formatPence(order.totalPence)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className={`${CARD} p-6`}>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-display text-2xl">Must go out today</h2>
              {dispatch.length > 0 && (
                <span className="text-sm text-ink-2">
                  {dispatched} of {dispatch.length} sent
                </span>
              )}
            </div>
            {dispatch.length === 0 ? (
              <p className="mt-3 text-sm text-ink-2">
                No order with a service date needs to leave today. Only orders whose customer gave a service date can
                be planned here.
              </p>
            ) : (
              <>
                <div
                  className="mt-3 h-1.5 overflow-hidden rounded-full bg-line"
                  role="progressbar"
                  aria-label="Sent so far"
                  aria-valuemin={0}
                  aria-valuemax={dispatch.length}
                  aria-valuenow={dispatched}
                >
                  <div className="h-full rounded-full bg-star" style={{ width: `${(dispatched / dispatch.length) * 100}%` }} />
                </div>
                <ul className="mt-2 divide-y divide-line">
                  {dispatch.map((row) => (
                    <li key={row.orderId} className="flex items-center gap-3 py-3">
                      <span
                        aria-hidden
                        className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
                          row.sent ? "bg-success-bg text-star" : "border-2 border-line-2"
                        }`}
                      >
                        {row.sent && <Check size={14} strokeWidth={3} />}
                      </span>
                      <Link href={`/admin/orders/${row.orderId}`} className="min-w-0 flex-1 hover:underline">
                        <span className="font-semibold">{row.orderNumber}</span> {row.product}
                      </Link>
                      <span className="shrink-0 text-sm text-ink-2">
                        {row.sent ? "Sent" : row.status === "in_production" ? "Printing" : "To print"}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className={`${CARD} p-6`}>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-display text-2xl">Takings</h2>
              <span className="text-sm text-ink-2">Net of refunds, inc. VAT</span>
            </div>
            <p className="mt-4 text-sm text-ink-2">This month</p>
            <p className="flex flex-wrap items-baseline gap-x-3">
              <span className="font-display text-4xl leading-tight">{formatPence(takings.month.netPence)}</span>
              {monthChange && (
                <span className="text-sm text-ink-2">
                  {monthChange} on last month to date ({formatPence(takings.lastMonthToDate.netPence)})
                </span>
              )}
            </p>
            <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
              {[
                ["Today", formatPence(takings.today.netPence), `${takings.today.orders} ${takings.today.orders === 1 ? "order" : "orders"}`],
                ["This week", formatPence(takings.week.netPence), `${takings.week.orders} ${takings.week.orders === 1 ? "order" : "orders"}`],
                [
                  "Avg order",
                  takings.averageOrderPence === null ? "—" : formatPence(takings.averageOrderPence),
                  `${takings.month.orders} this month`,
                ],
              ].map(([label, value, note]) => (
                <div key={label}>
                  <dt className="text-xs text-ink-2">{label}</dt>
                  <dd className="font-display text-xl leading-snug">{value}</dd>
                  <dd className="text-xs text-ink-2">{note}</dd>
                </div>
              ))}
            </dl>
            {takings.month.refundedPence > 0 && (
              <p className="mt-3 text-xs text-ink-2">
                {formatPence(takings.month.refundedPence)} refunded this month.
              </p>
            )}
            <AdminTakingsChart weeks={takings.weekly} />
          </section>

          <section className={`${CARD} p-6`}>
            <h2 className="font-display text-2xl">Selling this month</h2>
            {sales.length === 0 ? (
              <p className="mt-3 text-sm text-ink-2">No orders yet this month.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {sales.map((row) => (
                  <li key={row.label} className="flex items-baseline justify-between gap-3 py-3">
                    <span className="min-w-0">
                      <span className="block">{row.label}</span>
                      <span className="block text-xs text-ink-2">
                        {row.orders} {row.orders === 1 ? "order" : "orders"} · {row.copies.toLocaleString("en-GB")} copies
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold">{formatPence(row.pence)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={`${CARD} p-6`}>
            <h2 className="font-display text-2xl">Catalogue</h2>
            <ul className="mt-3 divide-y divide-line">
              {[
                ["Products & prices", "/admin/products", catalogue.products, "on sale"],
                [
                  "Templates",
                  "/admin/templates",
                  catalogue.templates,
                  catalogue.draftTemplates > 0 ? `live · ${catalogue.draftTemplates} in draft` : "live",
                ],
                ["Categories", "/admin/categories", catalogue.categories, "in use"],
              ].map(([label, href, count, note]) => (
                <li key={href} className="flex items-baseline justify-between gap-3 py-3">
                  <Link href={href as string} className="link">
                    {label}
                  </Link>
                  <span className="text-sm text-ink-2">
                    <span className="font-semibold text-ink">{count}</span> {note}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
