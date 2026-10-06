import { Check } from "lucide-react";

export const UPLOAD_STEPS = ["What you’re printing", "Your design", "Check and preview", "Confirm"] as const;

/**
 * The upload flow's progress: done steps ticked (and a way back to them),
 * the current one boxed, the rest waiting.
 */
export default function UploadSteps({
  current,
  onGoBack,
}: {
  /** 0-based. */
  current: number;
  onGoBack: (step: number) => void;
}) {
  return (
    <nav aria-label="Steps">
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {UPLOAD_STEPS.map((label, index) => {
          const done = index < current;
          const here = index === current;
          const badge = (
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold ${
                done ? "bg-success-bg text-star" : here ? "bg-plum text-white" : "bg-mist-3 text-ink-3"
              }`}
            >
              {done ? <Check size={17} strokeWidth={2.75} aria-hidden /> : index + 1}
            </span>
          );
          const body = (
            <>
              {badge}
              <span>
                {label}
                {done && <span className="sr-only"> (done — go back to this step)</span>}
              </span>
            </>
          );
          const shared = "flex min-h-[56px] w-full items-center gap-3 rounded-lg border px-4 text-left text-base font-semibold";
          return (
            <li key={label}>
              {done ? (
                <button
                  type="button"
                  onClick={() => onGoBack(index)}
                  className={`${shared} border-transparent text-ink hover:bg-mist-2`}
                >
                  {body}
                </button>
              ) : (
                <div
                  aria-current={here ? "step" : undefined}
                  className={`${shared} ${here ? "border-line-2 bg-surface text-ink" : "border-transparent text-ink-3"}`}
                >
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
