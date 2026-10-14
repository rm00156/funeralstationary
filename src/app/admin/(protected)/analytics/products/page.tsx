import {
  AnalyticsCard,
  AnalyticsFootnote,
  AnalyticsHeader,
  BarList,
  CARD,
  EmptyNote,
  Insight,
  StatTile,
  StatTiles,
} from "@/components/AdminAnalyticsParts";
import {
  analyticsPeriod,
  bookletStats,
  familiesWhoOrdered,
  parsePeriod,
  percentText,
  repeatStats,
  REPEAT_WINDOW_DAYS,
  SAME_DESIGN,
  UPLOAD_WARNING_LABELS,
  uploadWarnings,
} from "@/lib/adminAnalytics";
import { loadAnalyticsFacts, loadProductInfo } from "@/lib/adminAnalytics.server";

export const dynamic = "force-dynamic";

const dayText = (days: number | null) =>
  days === null ? "—" : days < 1 ? "Same day" : `${Math.round(days)} ${Math.round(days) === 1 ? "day" : "days"} later`;

/** Bars for each copies option, with the count printed above — one series, so one colour. */
function CopiesHistogram({ rows }: { rows: { copies: number; count: number }[] }) {
  const top = Math.max(...rows.map((row) => row.count), 1);
  return (
    <figure>
      <div className="flex h-48 items-end gap-2" aria-hidden>
        {rows.map((row) => (
          <div key={row.copies} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-xs font-semibold tabular-nums">{row.count}</span>
            <span className="w-full rounded-t bg-plum" style={{ height: `${Math.max((row.count / top) * 85, 2)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 border-t border-line-2 pt-2 text-xs text-ink-2" aria-hidden>
        {rows.map((row) => (
          <span key={row.copies} className="flex-1 text-center tabular-nums">
            {row.copies}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Booklet lines by number of copies</caption>
        <thead>
          <tr>
            <th scope="col">Copies</th>
            <th scope="col">Orders</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.copies}>
              <td>{row.copies}</td>
              <td>{row.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/**
 * /admin/analytics/products — what families choose: copies, pages, what
 * they add, whether they come back, and what the upload check catches.
 * Families only: a funeral director orders for many families, so trade
 * orders would blur every one of these.
 */
export default async function AdminAnalyticsProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const now = new Date();
  const period = analyticsPeriod(parsePeriod((await searchParams).period), now);
  const [facts, products] = await Promise.all([loadAnalyticsFacts(period), loadProductInfo()]);

  const families = facts.orders.filter((order) => order.tradeFirmId === null);
  const history = facts.history.filter((order) => order.tradeFirmId === null);
  const booklets = bookletStats(families, period, products);
  const repeats = repeatStats(families, history, period);
  const uploads = uploadWarnings(families, period);
  const label = (slug: string) => products.get(slug)?.label ?? slug;
  const bookletNames = [...products.values()].filter((product) => product.booklet).map((product) => product.label);
  const bookletName = bookletNames.length === 1 ? bookletNames[0] : "Booklet";
  const commonest = [...booklets.copies].sort((a, b) => b.count - a.count)[0];
  const thanks = repeats.next.find((row) => row.key !== SAME_DESIGN);

  return (
    <div className="font-body text-ink">
      <AnalyticsHeader period={period} tab="products" note="families only" />

      <StatTiles>
        <StatTile
          label={`Copies per ${bookletName} order`}
          value={booklets.medianCopies ?? "—"}
          note={booklets.averageCopies === null ? "No booklets ordered" : `Median · average ${booklets.averageCopies}`}
        />
        <StatTile
          label="Booklets with something added"
          value={percentText(booklets.withMore, booklets.orders)}
          note="Bookmarks, cards or anything else in the same order"
        />
        <StatTile
          label="Families who order again"
          value={percentText(repeats.repeaters, repeats.firstTimers)}
          note={`Within ${REPEAT_WINDOW_DAYS} days of their first order`}
        />
        <StatTile
          label="Families who ordered"
          value={familiesWhoOrdered(families, period).toLocaleString("en-GB")}
          note={`${repeats.firstTimers.toLocaleString("en-GB")} for the first time`}
        />
      </StatTiles>

      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsCard title="How many copies families order" description={`${bookletName} orders, by number of copies`}>
          {booklets.copies.length === 0 ? (
            <EmptyNote>No booklets ordered in this period.</EmptyNote>
          ) : (
            <>
              <CopiesHistogram rows={booklets.copies} />
              {commonest && (
                <Insight>
                  Most families order {commonest.copies} copies ({percentText(commonest.count, booklets.lines)} of
                  booklets). Worth checking the price for {commonest.copies} reads well against the options either
                  side of it.
                </Insight>
              )}
            </>
          )}
        </AnalyticsCard>

        <AnalyticsCard title="Pages per booklet" description={`Share of ${bookletName} orders`}>
          {booklets.pages.length === 0 ? (
            <EmptyNote>No booklets ordered in this period.</EmptyNote>
          ) : (
            <>
              <BarList
                max={100}
                labelWidth="w-24"
                rows={booklets.pages.map((row) => ({ label: row.key, value: row.share ?? 0, display: `${row.share ?? 0}%` }))}
              />
              <h3 className="mb-3 mt-6 text-sm font-semibold">Added to a booklet order</h3>
              {booklets.addOns.length === 0 ? (
                <EmptyNote>Nothing else was added to a booklet order.</EmptyNote>
              ) : (
                <BarList
                  max={100}
                  rows={booklets.addOns.map((row) => ({
                    label: label(row.key),
                    value: row.share ?? 0,
                    display: `${row.share ?? 0}%`,
                  }))}
                />
              )}
            </>
          )}
        </AnalyticsCard>

        <section className={`${CARD} overflow-hidden`}>
          <div className="px-6 pt-6">
            <h2 className="font-display text-2xl">What families order next</h2>
            <p className="mt-0.5 text-sm text-ink-2">
              After a first order in this period, within {REPEAT_WINDOW_DAYS} days
            </p>
          </div>
          {repeats.next.length === 0 ? (
            <p className="px-6 py-6 text-sm text-ink-2">
              {repeats.firstTimers > 0
                ? "No family has ordered again yet."
                : "No family placed a first order in this period."}
            </p>
          ) : (
            <>
              <div className="table-stack mt-5">
                <table className="w-full text-left text-sm">
                  <thead className="bg-mist-2 text-ink-2">
                    <tr className="border-y border-line">
                      <th scope="col" className="px-6 py-3 font-semibold">Next order</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Families</th>
                      <th scope="col" className="px-6 py-3 text-right font-semibold">Typically</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {repeats.next.map((row) => (
                      <tr key={row.key}>
                        <td data-stack="title" className="px-6 py-3">
                          {row.key === SAME_DESIGN ? "More copies of the same design" : label(row.key)}
                        </td>
                        <td data-stack="end" className="px-4 py-3 text-right font-semibold tabular-nums">
                          {row.share ?? 0}%
                        </td>
                        <td data-label="Typically" className="px-6 py-3 text-right">{dayText(row.medianDays)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-line px-6 py-4 text-sm text-ink-2">
                {thanks
                  ? `${label(thanks.key)} typically follow ${dayText(thanks.medianDays).toLowerCase()}. `
                  : ""}
                Shares are of the {repeats.firstTimers} {repeats.firstTimers === 1 ? "family" : "families"} who first
                ordered in this period; recent ones have had less time to come back.
              </p>
            </>
          )}
        </section>

        <AnalyticsCard
          title="Uploaded designs: what the check warned about"
          description="PDFs ordered in this period, by the warning the customer chose to print anyway"
        >
          {uploads.uploads === 0 ? (
            <EmptyNote>No uploaded PDFs were ordered in this period.</EmptyNote>
          ) : (
            <>
              <BarList
                max={100}
                labelWidth="w-48"
                rows={[
                  ...uploads.rows.map((row) => ({
                    label: UPLOAD_WARNING_LABELS[row.key as keyof typeof UPLOAD_WARNING_LABELS] ?? row.key,
                    value: row.share ?? 0,
                    display: `${row.share ?? 0}%`,
                  })),
                  {
                    label: "No warnings",
                    value: Math.round((uploads.clean / uploads.uploads) * 100),
                    display: percentText(uploads.clean, uploads.uploads),
                  },
                ]}
              />
              <Insight>
                A file the check refused (wrong size, wrong page count) can’t be ordered, so it never shows here —
                these are files that printed with a warning. {uploads.uploads}{" "}
                {uploads.uploads === 1 ? "upload" : "uploads"} in all; Canva links are checked by hand and aren’t
                counted.
              </Insight>
            </>
          )}
        </AnalyticsCard>
      </div>

      <AnalyticsFootnote>
        Families only — trade orders are on the Trade accounts tab. A family is an email address: the account’s, or
        the one given at checkout. The calculator on each design page isn’t tracked, so how often it leads to an
        order isn’t shown.
      </AnalyticsFootnote>
    </div>
  );
}
