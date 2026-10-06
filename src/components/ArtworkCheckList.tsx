import type { ReactNode } from "react";
import { Check, X } from "lucide-react";

import type { ArtworkCheck } from "@/lib/artwork";

const BADGE: Record<ArtworkCheck["status"], { className: string; label: string; icon: ReactNode }> = {
  pass: {
    className: "bg-success-bg text-star",
    label: "Fine",
    icon: <Check size={18} strokeWidth={2.5} aria-hidden />,
  },
  warn: {
    className: "bg-warn-bg text-warn-text",
    label: "Worth a look",
    icon: (
      <span aria-hidden className="text-lg font-bold leading-none">
        !
      </span>
    ),
  },
  block: {
    className: "bg-block-bg text-block-text",
    label: "Needs changing",
    icon: <X size={18} strokeWidth={2.5} aria-hidden />,
  },
};

/** The upload flow's "We've checked your file" list, one row per check. */
export default function ArtworkCheckList({ checks }: { checks: readonly ArtworkCheck[] }) {
  return (
    <ul className="divide-y divide-line border-t border-line">
      {checks.map((check) => {
        const { className, label, icon } = BADGE[check.status];
        return (
          <li key={check.id} className="flex gap-4 py-5">
            <span
              className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${className}`}
            >
              {icon}
            </span>
            <div>
              <p className="text-[19px] font-semibold leading-snug text-ink">
                <span className="sr-only">{label}: </span>
                {check.title}
              </p>
              <p className="mt-1 text-ink-2">{check.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
