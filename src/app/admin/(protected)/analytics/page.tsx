import Link from "next/link";

import AdminAnalyticsTakingsChart from "@/components/AdminAnalyticsTakingsChart";
import {
  AnalyticsCard,
  AnalyticsFootnote,
  AnalyticsHeader,
  BarList,
  CARD,
  ChangeNote,
  EmptyNote,
  Insight,
  StatTile,
  StatTiles,
} from "@/components/AdminAnalyticsParts";
import {
  analyticsPeriod,
  biggestDrop,
  cancelledCount,
  designSources,
  funnelSteps,
  orderToDispatch,
  ordersByProduct,
  overviewHeadlines,
  parsePeriod,
  parseWorkingHours,
  percentText,
  serviceTimeliness,
  SOURCE_LABELS,
  takingsByBucket,
  topTemplates,
} from "@/lib/adminAnalytics";
import {
  countPublishedTemplates,
  loadAnalyticsFacts,
  loadDesignFunnel,
  loadProductInfo,
  loadTemplateMeta,
} from "@/lib/adminAnalytics.server";
import { durationText } from "@/lib/adminDashboard";
import { formatPence } from "@/lib/orderOfServicePricing";
import { OPENING_HOURS } from "@/lib/site";

export const dynamic = "force-dynamic";

/** /admin/analytics — the overview: money, orders, what sells, and whether it arrived in time. */
export default async function AdminAnalyticsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const now = new Date();
  const period = analyticsPeriod(parsePeriod((await searchParams).period), now);
  const [facts, products, funnel, templateCount, templateMeta] = await Promise.all([
    loadAnalyticsFacts(period),
    loadProductInfo(),
    loadDesignFunnel(period),
    countPublishedTemplates(),
    loadTemplateMeta(),
  ]);

  const headlines = overviewHeadlines(facts.orders, facts.refunds, period);
  const timeliness = serviceTimeliness(facts.orders, period, now);
  const dispatch = orderToDispatch(facts.orders, period, parseWorkingHours(OPENING_HOURS));
  const productRows = ordersByProduct(facts.orders, period);
  const sources = designSources(facts.orders, period);
  const templates = topTemplates(facts.orders, period);
  const steps = funnelSteps([
    { label: "Started a design or upload", count: funnel.started },
    { label: "Put in a basket", count: funnel.inBasket },
    { label: "Ordered", count: funnel.ordered },
  ]);
  const drop = biggestDrop(steps);
  const cancelled = cancelledCount(facts.orders, period);
  const uploads = sources.filter((row) => row.key !== "template").reduce((sum, row) => sum + row.count, 0);
  const lines = sources.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="font-body text-ink">
      <AnalyticsHeader period={period} tab="overview" />

      <StatTiles>
        <StatTile
          label="Takings"
          value={formatPence(headlines.takings.current)}
          note={<ChangeNote {...headlines.takings} period={period} />}
        />
        <StatTile
          label="Orders"
          value={headlines.orders.current.toLocaleString("en-GB")}
          note={<ChangeNote {...headlines.orders} period={period} />}
        />
        <StatTile
          label="Average order"
          value={headlines.averageOrder.current === null ? "—" : formatPence(headlines.averageOrder.current)}
          note={
            headlines.averageOrder.current !== null && headlines.averageOrder.previous !== null ? (
              <ChangeNote
                current={headlines.averageOrder.current}
                previous={headlines.averageOrder.previous}
                period={period}
              />
            ) : (
              "Per payment, before refunds"
            )
          }
        />
        <StatTile
          label="Sent in time for the service"
          value={percentText(timeliness.inTime, timeliness.total, 1)}
          note={
            timeliness.total > 0
              ? `${timeliness.total - timeliness.inTime} late of ${timeliness.total}`
              : "No services with a date yet"
          }
        />
      </StatTiles>

      <div className="flex flex-col gap-6">
        <AnalyticsCard
          title={period.key === "12m" ? "Takings by month" : "Takings by week"}
          description="Families and trade accounts, net of refunds, including VAT and delivery"
        >
          <AdminAnalyticsTakingsChart buckets={takingsByBucket(facts.orders, facts.refunds, period)} />
        </AnalyticsCard>

        <div className="grid gap-6 lg:grid-cols-2">
          <AnalyticsCard title="What people order" description="Orders containing each product">
            {productRows.length === 0 ? (
              <EmptyNote>No orders in this period.</EmptyNote>
            ) : (
              <BarList
                rows={productRows.map((row) => ({
                  label: products.get(row.key)?.label ?? row.key,
                  value: row.count,
                  display: row.count.toLocaleString("en-GB"),
                }))}
              />
            )}
          </AnalyticsCard>

          <AnalyticsCard title="How designs are made" description="Share of order lines by where the artwork came from">
            {lines === 0 ? (
              <EmptyNote>No orders in this period.</EmptyNote>
            ) : (
              <>
                <BarList
                  max={100}
                  rows={sources.map((row) => ({
                    label: SOURCE_LABELS[row.key as keyof typeof SOURCE_LABELS],
                    value: row.share ?? 0,
                    display: `${row.share ?? 0}%`,
                  }))}
                />
                <Insight>
                  {uploads > 0
                    ? "Uploads and Canva links take more checking: a Canva link is checked by hand, and an upload may have been printed with a warning."
                    : "Every order this period was designed on the site."}{" "}
                  “We design it for you” is arranged by phone and email, so it isn’t counted here.
                </Insight>
              </>
            )}
          </AnalyticsCard>

          <AnalyticsCard title="Where people drop off" description="Designs and uploads started in the period, and what became of them">
            {funnel.started === 0 ? (
              <EmptyNote>Nobody started a design in this period.</EmptyNote>
            ) : (
              <>
                <ol className="space-y-4">
                  {steps.map((step) => (
                    <li key={step.label}>
                      {step.continued !== null && (
                        <p className="mb-2 text-xs text-ink-2">↓ {step.continued ?? 0}% carried on</p>
                      )}
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span>{step.label}</span>
                        <span className="font-semibold tabular-nums">{step.count.toLocaleString("en-GB")}</span>
                      </div>
                      <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-mist" aria-hidden>
                        <div
                          className="h-full rounded-full bg-plum"
                          style={{ width: `${step.count > 0 ? Math.max((step.count / funnel.started) * 100, 2) : 0}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ol>
                <Insight>
                  {drop
                    ? `The biggest drop is between “${drop.from.toLowerCase()}” and “${drop.to.toLowerCase()}”. `
                    : ""}
                  A design taken out of the basket again isn’t remembered, so “put in a basket” only counts those
                  still in one or ordered. Product page visits aren’t recorded — the site keeps no visitor
                  analytics.
                </Insight>
              </>
            )}
          </AnalyticsCard>

          <AnalyticsCard title="Keeping our promise" description="Did families get their stationery in time?">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                {
                  label: "Sent in time",
                  value: percentText(timeliness.inTime, timeliness.total, 1),
                  note:
                    timeliness.total > 0
                      ? `${timeliness.inTime} of ${timeliness.total} services with a date`
                      : "No services with a date yet",
                },
                {
                  label: "Late",
                  value: String(timeliness.late.length),
                  note:
                    timeliness.late.length > 0 ? (
                      <Link href={`/admin/analytics/production?period=${period.key}#late`} className="link">
                        See which orders
                      </Link>
                    ) : (
                      "None"
                    ),
                },
                {
                  label: "Order to dispatch",
                  value: dispatch.minutes === null ? "—" : durationText(Math.round(dispatch.minutes)),
                  note: "Median, working hours only",
                },
                {
                  label: "Cancelled",
                  value: String(cancelled),
                  note: `Of ${headlines.orders.current.toLocaleString("en-GB")} orders`,
                },
              ].map((tile) => (
                <div key={tile.label} className="rounded-lg bg-mist-2 p-4">
                  <dt className="text-sm text-ink-2">{tile.label}</dt>
                  <dd className="font-display text-3xl leading-tight">{tile.value}</dd>
                  <dd className="text-sm text-ink-2">{tile.note}</dd>
                </div>
              ))}
            </dl>
          </AnalyticsCard>
        </div>

        <section className={`${CARD} overflow-hidden`}>
          <div className="flex flex-wrap items-baseline justify-between gap-4 px-6 pt-6">
            <h2 className="font-display text-2xl">Most ordered templates</h2>
            <Link href="/admin/templates" className="link text-sm">
              All {templateCount} templates
            </Link>
          </div>
          {templates.length === 0 ? (
            <p className="px-6 py-6 text-sm text-ink-2">No template was ordered in this period.</p>
          ) : (
            <div className="table-stack mt-5">
              <table className="w-full text-left text-sm">
                <thead className="bg-mist-2 text-ink-2">
                  <tr className="border-y border-line">
                    <th scope="col" className="px-6 py-3 font-semibold">Template</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Category</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Orders</th>
                    <th scope="col" className="px-6 py-3 font-semibold">Share of template orders</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {templates.map((row) => {
                    const meta = templateMeta.get(row.key);
                    return (
                      <tr key={row.key}>
                        <td data-stack="title" className="px-6 py-3 font-semibold">{meta?.name ?? row.key}</td>
                        <td data-label="Category" className="px-4 py-3">{meta?.category ?? "—"}</td>
                        <td data-stack="end" className="px-4 py-3 text-right tabular-nums">{row.count}</td>
                        <td data-stack="full" className="px-6 py-3">
                          <span className="flex items-center gap-3">
                            <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-mist" aria-hidden>
                              <span className="block h-full rounded-full bg-plum" style={{ width: `${row.share ?? 0}%` }} />
                            </span>
                            <span className="w-10 text-right tabular-nums">{row.share ?? 0}%</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <AnalyticsFootnote>
        From the shop’s own orders. Takings are counted the day they were paid and refunds the day they were made,
        as on the Today page; orders the day they were placed.
      </AnalyticsFootnote>
    </div>
  );
}
