import { heatLevel, hourText } from "@/lib/adminAnalytics";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
/** One hue, light to dark — how many orders, never which kind. */
const LEVELS = ["bg-mist", "bg-plum/20", "bg-plum/45", "bg-plum/75", "bg-plum-night"];

/**
 * Orders by weekday and hour of the day, shop time. A line marks the
 * cut-off hour. Each square names its count on hover; the hidden table
 * carries every count for a screen reader.
 */
export default function AdminOrderHeatmap({ grid, cutoffHour }: { grid: number[][]; cutoffHour: number | null }) {
  const max = Math.max(...grid.flat(), 0);
  const hours = Array.from({ length: 24 }, (_, hour) => hour);

  return (
    <div>
      <div className="mb-3 flex items-center justify-end gap-2 text-xs text-ink-2" aria-hidden>
        Fewer
        {LEVELS.map((level) => (
          <span key={level} className={`size-3 rounded-sm ${level}`} />
        ))}
        More
      </div>
      <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2" aria-hidden>
        <span />
        <div className="grid grid-cols-24 gap-px text-[11px] text-ink-label">
          {hours.map((hour) => (
            <span
              key={hour}
              className={`whitespace-nowrap ${hour === cutoffHour ? "font-semibold text-ink" : ""}`}
            >
              {hour % 3 === 0 || hour === cutoffHour ? hourText(hour) : ""}
            </span>
          ))}
        </div>
        {grid.map((row, day) => (
          <div key={day} className="contents">
            <span className="flex items-center text-xs text-ink-2">{DAYS[day]}</span>
            <div className="mt-px grid grid-cols-24 gap-px">
              {row.map((count, hour) => (
                <span
                  key={hour}
                  title={`${DAY_NAMES[day]}, ${hourText(hour)}–${hourText((hour + 1) % 24)}: ${count} ${count === 1 ? "order" : "orders"}`}
                  className={`h-7 rounded-sm ${LEVELS[heatLevel(count, max)]} ${
                    hour === cutoffHour ? "shadow-[inset_2px_0_0_var(--color-ink)]" : ""
                  }`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>Orders by day and hour</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            {hours.map((hour) => (
              <th key={hour} scope="col">
                {hourText(hour)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((row, day) => (
            <tr key={day}>
              <th scope="row">{DAY_NAMES[day]}</th>
              {row.map((count, hour) => (
                <td key={hour}>{count}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
