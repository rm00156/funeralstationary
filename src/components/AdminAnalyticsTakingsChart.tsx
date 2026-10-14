"use client";

import { useState } from "react";

import { niceCeiling, type TakingsBucket } from "@/lib/adminAnalytics";
import { formatPence } from "@/lib/orderOfServicePricing";

const SERIES = [
  { key: "familiesPence", label: "Families", swatch: "bg-plum" },
  { key: "tradePence", label: "Trade", swatch: "bg-chart-gold" },
] as const;

/** "£2,000" on the axis — whole pounds. */
const axisText = (pence: number) => `£${Math.round(pence / 100).toLocaleString("en-GB")}`;

/**
 * Net takings per week (or month), families stacked under trade. Each
 * column is a hover/focus target with both figures; "Show as table" swaps
 * the bars for the same numbers — the gold is under 3:1 against white, so
 * the table is the way to read it exactly. A week whose refunds outweighed
 * its takings draws as nothing and reads as a negative in the table.
 */
export default function AdminAnalyticsTakingsChart({ buckets }: { buckets: TakingsBucket[] }) {
  const [asTable, setAsTable] = useState(false);
  const total = (bucket: TakingsBucket) => bucket.familiesPence + bucket.tradePence;
  const top = niceCeiling(Math.max(...buckets.map((bucket) => Math.max(bucket.familiesPence, 0) + Math.max(bucket.tradePence, 0)), 0));
  const ticks = [top, top / 2, 0];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-4 text-sm">
        <ul className="flex gap-4" aria-label="Key">
          {SERIES.map((series) => (
            <li key={series.key} className="flex items-center gap-2 text-ink">
              <span aria-hidden className={`size-3 rounded-sm ${series.swatch}`} />
              {series.label}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setAsTable((value) => !value)}
          aria-pressed={asTable}
          className="btn btn-outline min-h-11 px-4 text-sm"
        >
          {asTable ? "Show as chart" : "Show as table"}
        </button>
      </div>

      {asTable ? (
        <div className="table-stack">
          <table className="w-full text-left text-sm">
            <thead className="bg-mist-2 text-ink-2">
              <tr className="border-y border-line">
                <th scope="col" className="px-4 py-3 font-semibold">Period</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Families</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Trade</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Total</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Payments</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {buckets.map((bucket) => (
                <tr key={bucket.start}>
                  <td data-stack="title" className="px-4 py-3 font-semibold">{bucket.longLabel}</td>
                  <td data-label="Families" className="px-4 py-3 text-right tabular-nums">{formatPence(bucket.familiesPence)}</td>
                  <td data-label="Trade" className="px-4 py-3 text-right tabular-nums">{formatPence(bucket.tradePence)}</td>
                  <td data-stack="end" className="px-4 py-3 text-right font-semibold tabular-nums">{formatPence(total(bucket))}</td>
                  <td data-label="Payments" className="px-4 py-3 text-right tabular-nums">{bucket.payments}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <figure>
          <div className="flex gap-2">
            <div className="relative w-12 shrink-0 text-right text-xs text-ink-label" aria-hidden>
              {ticks.map((tick, index) => (
                <span
                  key={tick}
                  className="absolute right-0 -translate-y-1/2"
                  style={{ top: `${(index / (ticks.length - 1)) * 100}%` }}
                >
                  {axisText(tick)}
                </span>
              ))}
            </div>
            <div className="relative h-56 min-w-0 flex-1">
              {ticks.map((tick, index) => (
                <span
                  key={tick}
                  aria-hidden
                  className={`absolute inset-x-0 border-t ${index === ticks.length - 1 ? "border-line-2" : "border-line"}`}
                  style={{ top: `${(index / (ticks.length - 1)) * 100}%` }}
                />
              ))}
              <div className="relative flex h-full items-end gap-1 sm:gap-2">
                {buckets.map((bucket, index) => {
                  const families = Math.max(bucket.familiesPence, 0);
                  const trade = Math.max(bucket.tradePence, 0);
                  return (
                    <div
                      key={bucket.start}
                      tabIndex={0}
                      aria-label={`${bucket.longLabel}: families ${formatPence(bucket.familiesPence)}, trade ${formatPence(bucket.tradePence)}`}
                      className="group relative flex h-full flex-1 flex-col justify-end gap-0.5 rounded-t outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    >
                      {trade > 0 && (
                        <div className="w-full rounded-t bg-chart-gold" style={{ height: `${(trade / top) * 100}%` }} />
                      )}
                      {families > 0 && (
                        <div
                          className={`w-full bg-plum ${trade > 0 ? "" : "rounded-t"}`}
                          style={{ height: `${(families / top) * 100}%` }}
                        />
                      )}
                      <div
                        className={`pointer-events-none absolute bottom-full z-10 mb-2 hidden w-max rounded-lg bg-plum-night px-3 py-2 text-xs text-white shadow-menu group-hover:block group-focus-visible:block ${
                          index > buckets.length / 2 ? "right-0" : "left-0"
                        }`}
                      >
                        <span className="block font-medium">{bucket.longLabel}</span>
                        <span className="block">Families {formatPence(bucket.familiesPence)}</span>
                        <span className="block">Trade {formatPence(bucket.tradePence)}</span>
                        <span className="block">
                          {bucket.payments} {bucket.payments === 1 ? "payment" : "payments"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="ml-14 mt-2 flex gap-1 text-xs text-ink-label sm:gap-2" aria-hidden>
            {buckets.map((bucket, index) => (
              <span
                key={bucket.start}
                className={`flex-1 text-center ${buckets.length > 6 && index % 2 === 1 ? "invisible sm:visible" : ""}`}
              >
                {bucket.label}
              </span>
            ))}
          </div>
        </figure>
      )}
    </div>
  );
}
