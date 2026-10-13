"use client";

import { useEffect, type ReactNode } from "react";
import { BookOpen, LayoutGrid, X } from "lucide-react";

import BookletPreview from "@/components/BookletPreview";
import { StaticPage } from "@/components/PageCanvas";
import { pageMetrics, type DesignPage, type PageTrim } from "@/lib/designEditor";

export type PreviewMode = "pages" | "booklet";

/**
 * The design preview: every page laid out flat, or the booklet to leaf
 * through. The editor's Preview button and an order's line open the same
 * dialog, so a customer sees what they paid for the way they saw it before.
 */
export default function DesignPreviewDialog({
  pages,
  trim,
  pageLabel,
  bookletPages = pages,
  bookletNote,
  mode,
  onModeChange,
  onClose,
  title = "Preview",
  children,
}: {
  pages: DesignPage[];
  trim: PageTrim;
  pageLabel: (index: number) => string;
  /** What the booklet is folded from, when that isn't `pages` (a template's three, expanded). */
  bookletPages?: DesignPage[];
  bookletNote?: ReactNode;
  mode: PreviewMode;
  onModeChange: (mode: PreviewMode) => void;
  onClose: () => void;
  title?: string;
  /** The footer's buttons, if any. */
  children?: ReactNode;
}) {
  const metrics = pageMetrics(trim);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Design preview"
      className="fixed inset-0 z-50 flex flex-col bg-on-surface/70 p-6"
      onClick={onClose}
    >
      <div
        className={`mx-auto flex max-h-full w-full flex-col rounded-xl bg-paper p-6 ${
          mode === "booklet" ? "h-full max-w-6xl" : "max-w-5xl"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-display text-xl text-primary">{title}</h2>
          <div
            role="group"
            aria-label="Preview as"
            className="flex rounded-lg border border-outline-variant/60 bg-surface-container-lowest p-0.5"
          >
            {(
              [
                { mode: "pages", label: "Pages", Icon: LayoutGrid },
                { mode: "booklet", label: "Booklet", Icon: BookOpen },
              ] as const
            ).map(({ mode: option, label, Icon }) => (
              <button
                key={option}
                type="button"
                aria-pressed={mode === option}
                onClick={() => onModeChange(option)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-body text-sm transition-colors ${
                  mode === option
                    ? "bg-primary-container text-white"
                    : "text-on-surface-variant hover:bg-surface-container hover:text-primary"
                }`}
              >
                <Icon size={15} aria-hidden />
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label="Close preview"
            onClick={onClose}
            className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container hover:text-primary"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        {mode === "booklet" ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden pb-2">
            {bookletNote && (
              <p className="text-center font-body text-xs text-on-surface-variant">{bookletNote}</p>
            )}
            <BookletPreview
              pages={bookletPages}
              pageW={metrics.pageW}
              pageH={metrics.pageH}
              renderPage={(page, scale) => <StaticPage page={page} trim={trim} scale={scale} plain />}
            />
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-6 overflow-auto pb-2">
            {pages.map((previewPage, index) => (
              <div key={previewPage.id} className="flex flex-col items-center gap-2">
                {/* The same height whatever the format: 0.45 of an A5 page. */}
                <StaticPage page={previewPage} trim={trim} scale={283.5 / metrics.pageH} />
                <span className="font-body text-xs text-on-surface-variant">{pageLabel(index)}</span>
              </div>
            ))}
          </div>
        )}
        {children && <div className="mt-4 flex flex-wrap justify-end gap-3">{children}</div>}
      </div>
    </div>
  );
}
