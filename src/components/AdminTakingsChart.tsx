import { shortDay } from "@/lib/adminDashboard";
import { formatPence } from "@/lib/orderOfServicePricing";

/**
 * Weekly takings as bars, oldest week first; the last bar is this week so
 * far. One series, so no legend — the card's heading names it. Each column
 * is its own hover/focus target with the figure, and a hidden table carries
 * the same numbers for screen readers.
 */
export default function AdminTakingsChart({
  weeks,
}: {
  weeks: { weekStart: string; netPence: number; orders: number }[];
}) {
  const max = Math.max(...weeks.map((week) => week.netPence), 1);
  const current = weeks.at(-1);

  return (
    <figure className="mt-5">
      <figcaption className="mb-3 flex items-baseline justify-between font-body text-xs text-ink-label">
        <span>Takings by week</span>
        {current && <span>This week so far: {formatPence(current.netPence)}</span>}
      </figcaption>
      <div className="flex h-28 items-end gap-0.5 border-b border-line-2" aria-hidden>
        {weeks.map((week, index) => {
          const height = week.netPence > 0 ? Math.max((week.netPence / max) * 100, 2) : 0;
          const last = index === weeks.length - 1;
          return (
            <div key={week.weekStart} className="group relative flex h-full flex-1 items-end">
              <div
                className={`w-full rounded-t ${last ? "bg-plum/45" : "bg-plum"} transition-opacity group-hover:opacity-80`}
                style={{ height: `${height}%` }}
              />
              <div
                className={`pointer-events-none absolute bottom-full z-10 mb-2 hidden w-max rounded-lg bg-plum-night px-3 py-2 font-body text-xs text-white shadow-menu group-hover:block ${
                  index > weeks.length / 2 ? "right-0" : "left-0"
                }`}
              >
                <span className="block font-medium">Week of {shortDay(week.weekStart)}</span>
                <span className="block">
                  {formatPence(week.netPence)} · {week.orders} {week.orders === 1 ? "order" : "orders"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between font-body text-xs text-ink-label" aria-hidden>
        <span>{weeks[0] && shortDay(weeks[0].weekStart)}</span>
        <span>This week</span>
      </div>
      <table className="sr-only">
        <caption>Takings by week, net of refunds</caption>
        <thead>
          <tr>
            <th scope="col">Week starting</th>
            <th scope="col">Orders</th>
            <th scope="col">Takings</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week.weekStart}>
              <td>{shortDay(week.weekStart)}</td>
              <td>{week.orders}</td>
              <td>{formatPence(week.netPence)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
