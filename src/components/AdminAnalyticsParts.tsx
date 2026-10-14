import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";

import {
  PERIOD_KEYS,
  PERIOD_LABELS,
  periodText,
  type Period,
  type PeriodKey,
} from "@/lib/adminAnalytics";

/**
 * The pieces every Analytics tab is built from: the header (range, period
 * switch, tabs), stat tiles, cards and labelled bar lists. Server
 * components — the only interactive chart is AdminAnalyticsTakingsChart.
 */

export const ANALYTICS_TABS = [
  { key: "overview", href: "/admin/analytics", label: "Overview" },
  { key: "trade", href: "/admin/analytics/trade", label: "Trade accounts" },
  { key: "production", href: "/admin/analytics/production", label: "Production & timings" },
  { key: "products", href: "/admin/analytics/products", label: "Products & customers" },
  { key: "marketing", href: "/admin/analytics/marketing", label: "Marketing & traffic" },
] as const;
export type AnalyticsTab = (typeof ANALYTICS_TABS)[number]["key"];

export const CARD = "rounded-xl border border-line bg-surface ambient-shadow";

const withPeriod = (href: string, period: PeriodKey) => `${href}?period=${period}`;

export function AnalyticsHeader({ period, tab, note }: { period: Period; tab: AnalyticsTab; note?: string }) {
  const tabHref = ANALYTICS_TABS.find((entry) => entry.key === tab)?.href ?? "/admin/analytics";
  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-2">
            {periodText(period)} · {PERIOD_LABELS[period.key].long}
            {note && ` · ${note}`}
          </p>
          <h1 className="font-display text-5xl leading-tight text-ink">Analytics</h1>
        </div>
        <nav aria-label="Period" className="flex rounded-xl bg-mist p-1">
          {PERIOD_KEYS.map((key) => {
            const current = key === period.key;
            return (
              <Link
                key={key}
                href={withPeriod(tabHref, key)}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold transition-colors ${
                  current ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink"
                }`}
              >
                {PERIOD_LABELS[key].short}
              </Link>
            );
          })}
        </nav>
      </div>
      <nav aria-label="Analytics" className="mt-6 overflow-x-auto border-b border-line">
        <ul className="flex min-w-max gap-6">
          {ANALYTICS_TABS.map((entry) => {
            const current = entry.key === tab;
            return (
              <li key={entry.key}>
                <Link
                  href={withPeriod(entry.href, period.key)}
                  aria-current={current ? "page" : undefined}
                  className={`-mb-px flex min-h-11 items-center border-b-2 text-[15px] font-medium transition-colors ${
                    current ? "border-plum-deep font-semibold text-plum-deep" : "border-transparent text-ink-2 hover:text-ink"
                  }`}
                >
                  {entry.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}

/** "▲ 14% vs previous 12 weeks"; nothing when there's nothing to compare with. */
export function ChangeNote({ current, previous, period }: { current: number; previous: number; period: Period }) {
  if (previous <= 0) return <span className="text-ink-2">Nothing to compare with yet</span>;
  const change = Math.round(((current - previous) / previous) * 100);
  const versus = `vs previous ${PERIOD_LABELS[period.key].short}`;
  if (change === 0) return <span className="text-ink-2">Level {versus}</span>;
  const Icon = change > 0 ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 ${change > 0 ? "text-success-text" : "text-warn-text"}`}>
      <Icon size={14} aria-hidden />
      <span>
        {change > 0 ? "Up" : "Down"} {Math.abs(change)}% {versus}
      </span>
    </span>
  );
}

export function StatTile({
  label,
  value,
  suffix,
  note,
}: {
  label: string;
  value: React.ReactNode;
  /** Smaller text after the value: "of 14". */
  suffix?: string;
  note?: React.ReactNode;
}) {
  return (
    <div className={`${CARD} p-5`}>
      <p className="text-sm text-ink-2">{label}</p>
      <p className="mt-1 font-display text-4xl leading-tight text-ink">
        {value}
        {suffix && <span className="ml-1.5 font-display text-xl text-ink-2">{suffix}</span>}
      </p>
      {note && <p className="mt-1 text-sm text-ink-2">{note}</p>}
    </div>
  );
}

export function StatTiles({ children }: { children: React.ReactNode }) {
  return <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

export function AnalyticsCard({
  title,
  description,
  action,
  id,
  flush = false,
  className = "",
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  id?: string;
  /** No padding under the heading — for a table that runs edge to edge. */
  flush?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`${CARD} scroll-mt-6 overflow-hidden ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-6 pt-6">
        <div>
          <h2 className="font-display text-2xl text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-ink-2">{description}</p>}
        </div>
        {action}
      </div>
      <div className={flush ? "mt-5" : "px-6 pb-6 pt-5"}>{children}</div>
    </section>
  );
}

/** A sentence that reads the card for the owner, under a hairline. */
export function Insight({ children }: { children: React.ReactNode }) {
  return <p className="mt-5 border-t border-line pt-4 text-sm text-ink-2">{children}</p>;
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-ink-2">{children}</p>;
}

export interface BarRow {
  label: string;
  /** Drives the bar's length. */
  value: number;
  /** What is printed at the end: "312", "58%". */
  display: string;
}

/**
 * Labelled horizontal bars against one scale (the largest row, or `max`).
 * One series, so one colour; the figures are printed, so a reader never has
 * to judge a length.
 */
export function BarList({ rows, max, labelWidth = "w-40" }: { rows: BarRow[]; max?: number; labelWidth?: string }) {
  const top = Math.max(max ?? 0, ...rows.map((row) => row.value), 1);
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.label} className="flex items-center gap-3 text-sm">
          <span className={`${labelWidth} shrink-0 text-ink`}>{row.label}</span>
          <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-mist" aria-hidden>
            <span
              className="block h-full rounded-full bg-plum"
              style={{ width: `${row.value > 0 ? Math.max((row.value / top) * 100, 2) : 0}%` }}
            />
          </span>
          <span className="w-12 shrink-0 text-right font-semibold tabular-nums text-ink">{row.display}</span>
        </li>
      ))}
    </ul>
  );
}

/** The honest footnote every tab ends with. */
export function AnalyticsFootnote({ children }: { children: React.ReactNode }) {
  return <p className="mt-6 text-sm text-ink-2">{children}</p>;
}
