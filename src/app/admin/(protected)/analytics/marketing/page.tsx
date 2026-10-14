import Link from "next/link";
import { Info } from "lucide-react";

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
import { analyticsPeriod, parsePeriod, percentText } from "@/lib/adminAnalytics";
import { addDays } from "@/lib/adminDashboard";
import { DEVICE_LABELS, pagePath, searchOpportunity } from "@/lib/searchConsole";
import { loadSearchReport } from "@/lib/searchConsole.server";

export const dynamic = "force-dynamic";

const positionText = (position: number) => (position > 0 ? position.toFixed(1) : "—");

/**
 * /admin/analytics/marketing — how people find the shop on Google, from
 * Search Console. That is all the traffic this page shows: visitor counts,
 * sources and devices for the whole site would need an analytics script that
 * sets cookies, and the site deliberately sets none that need consent.
 */
export default async function AdminAnalyticsMarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const now = new Date();
  const period = analyticsPeriod(parsePeriod((await searchParams).period), now);
  const result = await loadSearchReport({
    startDate: period.from,
    endDate: addDays(period.to, -1),
    previousStartDate: period.previousFrom,
    previousEndDate: addDays(period.from, -1),
  });

  return (
    <div className="font-body text-ink">
      <AnalyticsHeader period={period} tab="marketing" />

      <div className={`${CARD} mb-6 flex items-start gap-3 px-5 py-4 text-sm text-ink-2`}>
        <Info size={18} aria-hidden className="mt-0.5 shrink-0 text-plum" />
        <p>
          Searches come from Google Search Console, which reads Google’s side — nothing is added to the site. Visitor
          numbers, where visitors came from and phone vs computer for the whole site aren’t here: they need an
          analytics script that sets cookies, which would mean asking every visitor’s consent first (see the{" "}
          <Link href="/privacy" className="link">
            privacy notice
          </Link>
          ).
        </p>
      </div>

      {result.kind === "not-configured" ? (
        <AnalyticsCard title="Search Console isn’t connected" description="A one-off setup, about ten minutes">
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>
              In Google Cloud, create a service account (no roles needed) and make a JSON key for it.
            </li>
            <li>
              In Search Console, open the shop’s property → Settings → Users and permissions, and add the service
              account’s email with <strong>Restricted</strong> permission.
            </li>
            <li>
              Enable the “Google Search Console API” for the same Cloud project.
            </li>
            <li>
              In Vercel, set <code>GOOGLE_SEARCH_CONSOLE_SITE</code> (the property, e.g.{" "}
              <code>sc-domain:thefuneralstationery.co.uk</code>), <code>GOOGLE_SERVICE_ACCOUNT_EMAIL</code> and{" "}
              <code>GOOGLE_SERVICE_ACCOUNT_KEY</code> (the key’s <code>private_key</code>), then redeploy.
            </li>
          </ol>
        </AnalyticsCard>
      ) : result.kind === "failed" ? (
        <AnalyticsCard title="Search Console didn’t answer" description="Nothing is shown rather than old figures">
          <p className="text-sm text-ink-2">
            Google said: <span className="text-ink">{result.message}</span>. Check the service account still has
            access to the property and the API is enabled, then reload.
          </p>
        </AnalyticsCard>
      ) : (
        <SearchReportView report={result.report} period={period} />
      )}

      <AnalyticsFootnote>
        Search Console counts clicks and appearances on Google Search only (not Maps or ads), and its last two or
        three days are still filling in. Position is the average place in the results, 1 being the top.
      </AnalyticsFootnote>
    </div>
  );
}

function SearchReportView({
  report,
  period,
}: {
  report: Extract<Awaited<ReturnType<typeof loadSearchReport>>, { kind: "ok" }>["report"];
  period: ReturnType<typeof analyticsPeriod>;
}) {
  const clicks = report.total?.clicks ?? 0;
  const impressions = report.total?.impressions ?? 0;
  const deviceClicks = report.devices.reduce((sum, row) => sum + row.clicks, 0);
  const mobile = report.devices.find((row) => row.key === "MOBILE")?.clicks ?? 0;
  const opportunity = searchOpportunity(report.queries);

  return (
    <>
      <StatTiles>
        <StatTile
          label="Clicks from Google search"
          value={clicks.toLocaleString("en-GB")}
          note={<ChangeNote current={clicks} previous={report.previousTotal?.clicks ?? 0} period={period} />}
        />
        <StatTile
          label="Times shown in search"
          value={impressions.toLocaleString("en-GB")}
          note={<ChangeNote current={impressions} previous={report.previousTotal?.impressions ?? 0} period={period} />}
        />
        <StatTile
          label="Clicked when shown"
          value={percentText(clicks, impressions, 1)}
          note="Click-through rate"
        />
        <StatTile
          label="Searchers on a phone"
          value={percentText(mobile, deviceClicks)}
          note="Of clicks from Google search"
        />
      </StatTiles>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={`${CARD} overflow-hidden`}>
          <div className="px-6 pt-6">
            <h2 className="font-display text-2xl">What people search on Google</h2>
            <p className="mt-0.5 text-sm text-ink-2">Searches that brought people to the site</p>
          </div>
          {report.queries.length === 0 ? (
            <p className="px-6 py-6 text-sm text-ink-2">No searches in this period yet.</p>
          ) : (
            <>
              <div className="table-stack mt-5">
                <table className="w-full text-left text-sm">
                  <thead className="bg-mist-2 text-ink-2">
                    <tr className="border-y border-line">
                      <th scope="col" className="px-6 py-3 font-semibold">Search</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Clicks</th>
                      <th scope="col" className="px-6 py-3 text-right font-semibold">Position</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {report.queries.map((row) => (
                      <tr key={row.key}>
                        <td data-stack="title" className="px-6 py-3">{row.key}</td>
                        <td data-stack="end" className="px-4 py-3 text-right tabular-nums">
                          {row.clicks.toLocaleString("en-GB")}
                        </td>
                        <td data-label="Position" className="px-6 py-3 text-right tabular-nums">
                          {positionText(row.position)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {opportunity && (
                <p className="border-t border-line px-6 py-4 text-sm text-ink-2">
                  “{opportunity.key}” was shown {opportunity.impressions.toLocaleString("en-GB")} times but sits at
                  position {positionText(opportunity.position)}, below most people’s first look. A page written for
                  that search could lift it.
                </p>
              )}
            </>
          )}
        </section>

        <div className="flex flex-col gap-6">
          <AnalyticsCard title="Pages people land on" description="The page a Google search opened, by clicks">
            {report.pages.length === 0 ? (
              <EmptyNote>No clicks in this period yet.</EmptyNote>
            ) : (
              <BarList
                labelWidth="w-48 truncate"
                rows={report.pages.map((row) => ({
                  label: pagePath(row.key),
                  value: row.clicks,
                  display: row.clicks.toLocaleString("en-GB"),
                }))}
              />
            )}
          </AnalyticsCard>

          <AnalyticsCard title="Phone vs computer" description="Clicks from Google search, by device">
            {deviceClicks === 0 ? (
              <EmptyNote>No clicks in this period yet.</EmptyNote>
            ) : (
              <>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {report.devices.map((row) => (
                    <div key={row.key} className="rounded-lg bg-mist-2 p-4">
                      <dt className="text-sm text-ink-2">{DEVICE_LABELS[row.key] ?? row.key}</dt>
                      <dd className="font-display text-3xl leading-tight">{percentText(row.clicks, deviceClicks)}</dd>
                      <dd className="text-sm text-ink-2">{row.clicks.toLocaleString("en-GB")} clicks</dd>
                    </div>
                  ))}
                </dl>
                <Insight>
                  {mobile * 2 > deviceClicks
                    ? "Most people find the shop on a phone, so designing and checking out on a phone is the path to keep easy."
                    : "More people find the shop on a computer than a phone."}{" "}
                  Which device the order was then placed on isn’t recorded.
                </Insight>
              </>
            )}
          </AnalyticsCard>
        </div>
      </div>
    </>
  );
}
