import Link from "next/link";
import { Phone, TriangleAlert } from "lucide-react";

import {
  AnalyticsFootnote,
  AnalyticsHeader,
  CARD,
  ChangeNote,
  StatTile,
  StatTiles,
} from "@/components/AdminAnalyticsParts";
import {
  analyticsPeriod,
  lastOrderText,
  parsePeriod,
  parseTradeSort,
  percentText,
  QUIET_GAP_MULTIPLE,
  QUIET_MIN_DAYS,
  sortTradeRows,
  takingsBetween,
  totalOf,
  tradeAccountRows,
  TRADE_SORTS,
  TRADE_TREND_LABELS,
  type TradeSort,
  type TradeTrend,
} from "@/lib/adminAnalytics";
import { loadAnalyticsFacts, loadTradeFirms } from "@/lib/adminAnalytics.server";
import { formatPence } from "@/lib/orderOfServicePricing";
import { countPendingTradeApplications } from "@/lib/trade.server";

export const dynamic = "force-dynamic";

const SORT_LABELS: Record<TradeSort, string> = { takings: "Takings", "last-order": "Last order", name: "Name" };

const TREND_STYLES: Record<TradeTrend, string> = {
  new: "bg-mist text-plum-deep",
  growing: "bg-success-bg text-success-text",
  steady: "bg-mist text-ink-2",
  slowing: "bg-warn-bg text-warn-text",
  quiet: "bg-block-bg text-block-text",
  none: "bg-mist text-ink-label",
};

const TREND_MARKS: Record<TradeTrend, string> = {
  new: "★",
  growing: "↗",
  steady: "→",
  slowing: "↘",
  quiet: "!",
  none: "–",
};

const shortDate = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" }).format(date);

const weeksAgo = (days: number) => (days < 14 ? `${days} days ago` : `${Math.floor(days / 7)} weeks ago`);

/** Twelve (or four) tiny bars of a firm's takings, oldest first — zero weeks as a dash on the baseline. */
function Sparkline({ values }: { values: number[] }) {
  const top = Math.max(...values, 1);
  return (
    <span className="flex h-7 w-36 items-end gap-0.5" aria-hidden>
      {values.map((value, index) =>
        value > 0 ? (
          <span
            key={index}
            className="flex-1 rounded-t-sm bg-plum"
            style={{ height: `${Math.max((value / top) * 100, 12)}%` }}
          />
        ) : (
          <span key={index} className="h-px flex-1 bg-line-2" />
        ),
      )}
    </span>
  );
}

/** /admin/analytics/trade — how the funeral directors are ordering, and who has gone quiet. */
export default async function AdminAnalyticsTradePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; sort?: string }>;
}) {
  const now = new Date();
  const params = await searchParams;
  const period = analyticsPeriod(parsePeriod(params.period), now);
  const sort = parseTradeSort(params.sort);
  const [facts, firms, applications] = await Promise.all([
    loadAnalyticsFacts(period),
    loadTradeFirms(),
    countPendingTradeApplications(),
  ]);

  const current = takingsBetween(facts.orders, facts.refunds, period.from, period.to);
  const previous = takingsBetween(facts.orders, facts.refunds, period.previousFrom, period.from);
  const rows = tradeAccountRows({ firms, orders: facts.orders, refunds: facts.refunds, history: facts.history, period, now });
  const listed = sortTradeRows(
    rows.filter((row) => row.firm.isActive || row.orders > 0),
    sort,
  );
  const quiet = rows.filter((row) => row.trend === "quiet").sort((a, b) => b.takingsBeforePence - a.takingsBeforePence);
  const active = firms.filter((firm) => firm.isActive).length;
  const ordered = rows.filter((row) => row.firm.isActive && row.orders > 0).length;
  const share = (split: typeof current) => percentText(split.tradePence, totalOf(split));

  return (
    <div className="font-body text-ink">
      <AnalyticsHeader period={period} tab="trade" />

      <StatTiles>
        <StatTile
          label="Trade takings"
          value={formatPence(current.tradePence)}
          note={<ChangeNote current={current.tradePence} previous={previous.tradePence} period={period} />}
        />
        <StatTile
          label="Share of all takings"
          value={share(current)}
          note={totalOf(previous) > 0 ? `${share(previous)} in the period before` : "Nothing to compare with yet"}
        />
        <StatTile
          label="Accounts that ordered"
          value={ordered}
          suffix={`of ${active}`}
          note={active - ordered > 0 ? `${active - ordered} haven’t ordered this period` : "Every account has ordered"}
        />
        <StatTile
          label="Applications waiting"
          value={applications}
          note={
            <Link href="/admin/trade" className="link">
              {applications > 0 ? "Review applications" : "Trade accounts"}
            </Link>
          }
        />
      </StatTiles>

      {quiet.length > 0 && (
        <section className="mb-6 overflow-hidden rounded-xl border-2 border-warn-text/60 bg-surface ambient-shadow">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 bg-warn-bg px-6 py-4">
            <h2 className="flex items-center gap-2 font-display text-2xl">
              <TriangleAlert size={20} aria-hidden className="text-warn-text" />
              Gone quiet
            </h2>
            <p className="text-sm text-ink-2">Accounts ordering much less often than they usually do</p>
          </div>
          <ul className="divide-y divide-line">
            {quiet.map((row) => (
              <li key={row.firm.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4">
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/trade/${row.firm.id}`} className="font-semibold hover:underline">
                    {row.firm.name}
                  </Link>
                  <p className="text-sm text-ink-2">
                    Usually orders every {row.usualGapDays} days · last order{" "}
                    {row.daysSinceLast !== null && weeksAgo(row.daysSinceLast)}
                    {row.lastOrderAt && ` (${shortDate(row.lastOrderAt)})`}
                  </p>
                </div>
                <p className="text-sm text-ink-2">{formatPence(row.takingsBeforePence)} in the 12 weeks before</p>
                {row.firm.phone ? (
                  <a
                    href={`tel:${row.firm.phone.replace(/[^\d+]/g, "")}`}
                    className="btn btn-primary min-h-11 px-4 text-sm"
                    aria-label={`Call ${row.firm.name} on ${row.firm.phone}`}
                  >
                    <Phone size={16} aria-hidden />
                    Call
                  </a>
                ) : (
                  <Link href={`/admin/trade/${row.firm.id}`} className="btn btn-outline min-h-11 px-4 text-sm">
                    View account
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={`${CARD} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 pt-6">
          <h2 className="font-display text-2xl">All trade accounts</h2>
          <nav aria-label="Sort accounts" className="flex flex-wrap items-center gap-1 text-sm">
            <span className="mr-2 text-ink-2">Sort by</span>
            {TRADE_SORTS.map((key) => (
              <Link
                key={key}
                href={`/admin/analytics/trade?period=${period.key}&sort=${key}`}
                aria-current={key === sort ? "true" : undefined}
                className={`flex min-h-11 items-center rounded-lg border px-3 font-semibold ${
                  key === sort ? "border-plum bg-mist text-plum-deep" : "border-transparent text-ink-2 hover:text-ink"
                }`}
              >
                {SORT_LABELS[key]}
              </Link>
            ))}
          </nav>
        </div>
        {listed.length === 0 ? (
          <p className="px-6 py-6 text-sm text-ink-2">
            No trade accounts yet. They’re set up in{" "}
            <Link href="/admin/trade" className="link">
              Trade accounts
            </Link>
            .
          </p>
        ) : (
          <div className="table-stack table-stack-wide mt-5">
            <table className="w-full text-left text-sm">
              <thead className="bg-mist-2 text-ink-2">
                <tr className="border-y border-line">
                  <th scope="col" className="px-6 py-3 font-semibold">Account</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Takings</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Orders</th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {period.key === "12m" ? "Monthly" : "Weekly"} takings
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">Last order</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Orders every</th>
                  <th scope="col" className="px-6 py-3 font-semibold">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {listed.map((row) => {
                  const since = row.firm.createdAt;
                  const isNew = row.trend === "new";
                  return (
                    <tr key={row.firm.id} className="align-middle">
                      <td data-stack="title" className="px-6 py-3">
                        <Link href={`/admin/trade/${row.firm.id}`} className="link font-semibold">
                          {row.firm.name}
                        </Link>
                        <span className="block text-ink-2">
                          {!row.firm.isActive
                            ? "Retired"
                            : isNew
                              ? `New · ${new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(since)}`
                              : `Account since ${since.getFullYear()}`}
                        </span>
                      </td>
                      <td data-stack="end" className="px-4 py-3 text-right font-semibold tabular-nums">
                        {formatPence(row.takingsPence)}
                      </td>
                      <td data-label="Orders" className="px-4 py-3 text-right tabular-nums">{row.orders}</td>
                      <td data-label={period.key === "12m" ? "Monthly takings" : "Weekly takings"} className="px-4 py-3">
                        <Sparkline values={row.buckets} />
                      </td>
                      <td data-label="Last order" className="px-4 py-3">
                        {lastOrderText(row.daysSinceLast, row.lastOrderAt)}
                      </td>
                      <td data-label="Orders every" className="px-4 py-3 text-right tabular-nums">
                        {row.usualGapDays === null ? "—" : `${row.usualGapDays} days`}
                      </td>
                      <td data-label="Trend" className="px-6 py-3">
                        <span
                          className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${TREND_STYLES[row.trend]}`}
                        >
                          <span aria-hidden>{TREND_MARKS[row.trend]}</span>
                          {TRADE_TREND_LABELS[row.trend]}
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

      <AnalyticsFootnote>
        Takings are net of refunds and counted when paid — an order on account counts once its invoice is paid.
        “Orders every” is the firm’s usual gap between orders, once it has three. “Gone quiet” means at least{" "}
        {QUIET_GAP_MULTIPLE}× that gap, and {QUIET_MIN_DAYS} days or more, since its last order. Growing and slowing
        compare the second half of the period with the first.
      </AnalyticsFootnote>
    </div>
  );
}
