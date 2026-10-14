import Link from "next/link";

import AdminOrderHeatmap from "@/components/AdminOrderHeatmap";
import {
  AnalyticsCard,
  AnalyticsFootnote,
  AnalyticsHeader,
  CARD,
  EmptyNote,
  Insight,
  StatTile,
  StatTiles,
} from "@/components/AdminAnalyticsParts";
import {
  afterCutoff,
  analyticsPeriod,
  lateReason,
  orderHeatmap,
  orderToDispatch,
  parsePeriod,
  parseWorkingHours,
  percentText,
  serviceTimeliness,
  stageTimes,
} from "@/lib/adminAnalytics";
import { loadAnalyticsFacts, loadProductInfo } from "@/lib/adminAnalytics.server";
import { durationText, parseCutoff, shortDay, shopDate } from "@/lib/adminDashboard";
import { copiesText } from "@/lib/orderOfServicePricing";
import { OPENING_HOURS, ORDER_CUTOFF } from "@/lib/site";

export const dynamic = "force-dynamic";

const minutesText = (minutes: number | null) => (minutes === null ? "—" : durationText(Math.round(minutes)));

/** /admin/analytics/production — how long orders take, when they come in, and which were late. */
export default async function AdminAnalyticsProductionPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const now = new Date();
  const period = analyticsPeriod(parsePeriod((await searchParams).period), now);
  const [facts, products] = await Promise.all([loadAnalyticsFacts(period), loadProductInfo()]);

  const hours = parseWorkingHours(OPENING_HOURS);
  const dispatch = orderToDispatch(facts.orders, period, hours);
  const stages = stageTimes(facts.orders, period, hours);
  const cutoff = afterCutoff(facts.orders, period, ORDER_CUTOFF);
  const timeliness = serviceTimeliness(facts.orders, period, now);
  const grid = orderHeatmap(facts.orders, period);
  const cutoffMinutes = parseCutoff(ORDER_CUTOFF);
  const longestStage = stages.filter((stage) => stage.minutes !== null).sort((a, b) => (b.minutes ?? 0) - (a.minutes ?? 0))[0];
  const stageMax = Math.max(...stages.map((stage) => stage.minutes ?? 0), 1);
  const reasons = timeliness.late.map((order) => lateReason(order, ORDER_CUTOFF));
  const reasonCounts = [...new Set(reasons)].map((reason) => `${reasons.filter((r) => r === reason).length} ${reason.toLowerCase()}`);

  return (
    <div className="font-body text-ink">
      <AnalyticsHeader period={period} tab="production" />

      <StatTiles>
        <StatTile label="Order to dispatch" value={minutesText(dispatch.minutes)} note="Median, working hours only" />
        <StatTile
          label="Order to press"
          value={minutesText(stages[0].minutes)}
          note="Median, from placed to printing"
        />
        <StatTile
          label="Ordered after the cut-off"
          value={percentText(cutoff.count, cutoff.total)}
          note={`After ${ORDER_CUTOFF} or at the weekend — can’t go out that day`}
        />
        <StatTile
          label="Sent in time for the service"
          value={percentText(timeliness.inTime, timeliness.total, 1)}
          note={
            timeliness.total > 0
              ? `${timeliness.late.length} late of ${timeliness.total}`
              : "No services with a date yet"
          }
        />
      </StatTiles>

      <div className="flex flex-col gap-6">
        <AnalyticsCard title="Where the time goes" description={`Median time each step takes, in working hours (${OPENING_HOURS})`}>
          <ol className="space-y-3">
            {stages.map((stage, index) => (
              <li key={stage.label} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm sm:flex-nowrap">
                <span className="w-full shrink-0 sm:w-64">
                  {index + 1}. {stage.label}
                </span>
                <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-mist" aria-hidden>
                  <span
                    className="block h-full rounded-full bg-plum"
                    style={{ width: `${stage.minutes ? Math.max((stage.minutes / stageMax) * 100, 2) : 0}%` }}
                  />
                </span>
                <span className="w-24 shrink-0 text-right font-semibold tabular-nums">
                  {minutesText(stage.minutes)}
                  <span className="block text-xs font-normal text-ink-2">
                    {stage.orders} {stage.orders === 1 ? "order" : "orders"}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <Insight>
            {longestStage
              ? `The longest step is “${longestStage.label.toLowerCase()}”. `
              : "No order has moved on yet in this period. "}
            Times come from the status changes made in Thintent (or here), so they are only as prompt as those were.
            Delivered is when Thintent marked the job complete.
          </Insight>
        </AnalyticsCard>

        <AnalyticsCard title="When orders come in" description="Orders by day and hour, shop time">
          {cutoff.total === 0 ? (
            <EmptyNote>No orders in this period.</EmptyNote>
          ) : (
            <>
              <AdminOrderHeatmap
                grid={grid}
                cutoffHour={cutoffMinutes !== null && cutoffMinutes % 60 === 0 ? cutoffMinutes / 60 : null}
              />
              <p className="mt-3 text-sm font-semibold">Point at a square to see the number of orders.</p>
              <Insight>
                The dark line marks the {ORDER_CUTOFF} cut-off. {percentText(cutoff.count, cutoff.total)} of orders
                came in after it on a weekday or at the weekend, so couldn’t go out the same day.
              </Insight>
            </>
          )}
        </AnalyticsCard>

        <section id="late" className={`${CARD} scroll-mt-6 overflow-hidden`}>
          <div className="flex flex-wrap items-baseline justify-between gap-4 px-6 pt-6">
            <h2 className="font-display text-2xl">Late orders ({timeliness.late.length})</h2>
            {reasonCounts.length > 0 && <p className="text-sm text-ink-2">{reasonCounts.join(" · ")}</p>}
          </div>
          {timeliness.late.length === 0 ? (
            <p className="px-6 py-6 text-sm text-ink-2">
              {timeliness.total > 0
                ? "Every order with a service date in this period went out in time."
                : "No order in this period gave a service date that has passed yet."}
            </p>
          ) : (
            <div className="table-stack mt-5">
              <table className="w-full text-left text-sm">
                <thead className="bg-mist-2 text-ink-2">
                  <tr className="border-y border-line">
                    <th scope="col" className="px-6 py-3 font-semibold">Order</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Product</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Placed</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Service date</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Sent</th>
                    <th scope="col" className="px-6 py-3 font-semibold">Why</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {timeliness.late.map((order, index) => (
                    <tr key={order.id}>
                      <td data-stack="title" className="px-6 py-3">
                        <Link href={`/admin/orders/${order.id}`} className="link whitespace-nowrap font-semibold">
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td data-label="Product" className="px-4 py-3">
                        {order.productSlugs.map((slug) => products.get(slug)?.label ?? slug).join(", ")} ·{" "}
                        {copiesText(order.copies)}
                      </td>
                      <td data-label="Placed" className="px-4 py-3">{shortDay(shopDate(order.placedAt))}</td>
                      <td data-label="Service date" className="px-4 py-3">{shortDay(order.serviceDate)}</td>
                      <td data-label="Sent" className="px-4 py-3">
                        {order.sentAt ? shortDay(shopDate(order.sentAt)) : "Not sent"}
                      </td>
                      <td data-label="Why" className="px-6 py-3">{reasons[index]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <AnalyticsFootnote>
        An order is in time when it was sent on a day before its service — next-day delivery. Only orders with a
        service date can be judged, and only once the service has happened. “Ordered too close to the service”
        means it came in after the {ORDER_CUTOFF} cut-off on the last working day before; why any other order was
        late (the press or the courier) isn’t recorded.
      </AnalyticsFootnote>
    </div>
  );
}
