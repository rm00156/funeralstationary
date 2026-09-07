"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { PAGE_H, PAGE_W, type DesignPage } from "@/lib/designEditor";

/** Slow into the fold, ease out flat — a page, not a swing door. */
const EASE = "cubic-bezier(.4,.1,.2,1)";

/**
 * A booklet the customer can leaf through, built from the design's pages.
 *
 * The model is the physical one — a saddle-stitched booklet is a stack of
 * leaves, and leaf k carries page 2k on its front and page 2k+1 on its back.
 * Turning a leaf rotates it about the spine; what you see open is the back
 * of the last leaf turned (left) and the front of the next (right). A
 * single card falls out of the same model as one leaf with a front and a
 * back, so nothing special-cases it.
 *
 * Faces are drawn by `renderPage`, which the editor points at its own
 * StaticPage — the booklet never draws a page itself, so it can't drift
 * from the editor or the proof.
 */
export default function BookletPreview({
  pages,
  renderPage,
  /** Sets the largest scale a page will render at; the stage shrinks below it to fit. */
  maxScale = 0.6,
}: {
  pages: DesignPage[];
  renderPage: (page: DesignPage, scale: number) => ReactNode;
  maxScale?: number;
}) {
  const leafCount = Math.max(1, Math.ceil(pages.length / 2));
  const [turned, setTurned] = useState(0);
  const [moving, setMoving] = useState<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(maxScale);

  // Fit the open spread (two pages wide) to whatever the modal gives us.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const fit = () => {
      const { width, height } = stage.getBoundingClientRect();
      const byWidth = (width - 32) / (PAGE_W * 2);
      const byHeight = (height - 32) / PAGE_H;
      setScale(Math.max(0.2, Math.min(maxScale, byWidth, byHeight)));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [maxScale]);

  const canTurn = pages.length > 1;
  const atStart = turned === 0;
  const atEnd = turned === leafCount;

  const go = useCallback(
    (direction: 1 | -1) => {
      if (!canTurn) return;
      setTurned((current) => {
        const next = current + direction;
        if (next < 0 || next > leafCount) return current;
        // The leaf in flight is the one crossing the spine: turning forward
        // it's leaf `current`, turning back it's leaf `current - 1`.
        setMoving(direction === 1 ? current : current - 1);
        return next;
      });
    },
    [canTurn, leafCount],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const w = PAGE_W * scale;
  const h = PAGE_H * scale;

  // Slide the book so what's visible sits centred: closed, only the right
  // half has anything on it; fully turned, only the left.
  const shift = atStart ? -w / 2 : atEnd ? w / 2 : 0;

  const caption = (() => {
    if (pages.length === 1) return "Front";
    if (atStart) return "Front cover";
    if (atEnd) return pages.length % 2 === 0 ? "Back cover" : "Back";
    const left = turned * 2;
    const right = left + 1;
    return right <= pages.length
      ? `Pages ${left} – ${right} of ${pages.length}`
      : `Page ${left} of ${pages.length}`;
  })();

  return (
    <div className="flex h-full min-h-0 flex-col items-center gap-4">
      <div
        ref={stageRef}
        className="flex min-h-[320px] w-full flex-1 items-center justify-center overflow-hidden"
      >
        <div
          className="relative transition-transform duration-700 motion-reduce:transition-none"
          style={{
            transitionTimingFunction: EASE,
            width: w * 2,
            height: h,
            perspective: 2200,
            transform: `translateX(${shift}px)`,
          }}
        >
          {/* A soft ground shadow under the whole book, not per page. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-[6%] -bottom-3 h-6 rounded-[50%] bg-on-surface/25 blur-md"
          />

          {Array.from({ length: leafCount }, (_, k) => {
            const isTurned = k < turned;
            const front = pages[k * 2];
            const back = pages[k * 2 + 1];
            // Unturned leaves stack with the first on top; turned ones with
            // the most recent on top. The one in flight beats both.
            const z = moving === k ? leafCount + 1 : isTurned ? k + 1 : leafCount - k;
            return (
              <div
                key={k}
                className="absolute top-0 transition-transform duration-700 motion-reduce:transition-none"
                style={{
                  transitionTimingFunction: EASE,
                  left: w,
                  width: w,
                  height: h,
                  transformOrigin: "left center",
                  transformStyle: "preserve-3d",
                  transform: `rotateY(${isTurned ? -180 : 0}deg)`,
                  zIndex: z,
                }}
                onTransitionEnd={() => setMoving((current) => (current === k ? null : current))}
              >
                <Face
                  page={front}
                  scale={scale}
                  renderPage={renderPage}
                  side="right"
                  onClick={!isTurned && !atEnd ? () => go(1) : undefined}
                />
                <Face
                  page={back}
                  scale={scale}
                  renderPage={renderPage}
                  side="left"
                  flipped
                  onClick={isTurned ? () => go(-1) : undefined}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={!canTurn || atStart}
          aria-label="Previous page"
          className="rounded-lg border-2 border-primary-container p-2 text-primary-container transition-colors hover:bg-surface-container disabled:opacity-40"
        >
          <ChevronLeft size={18} aria-hidden />
        </button>
        <span
          aria-live="polite"
          className="min-w-[10rem] text-center font-body text-sm text-on-surface-variant tabular-nums"
        >
          {caption}
        </span>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={!canTurn || atEnd}
          aria-label="Next page"
          className="rounded-lg border-2 border-primary-container p-2 text-primary-container transition-colors hover:bg-surface-container disabled:opacity-40"
        >
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>
    </div>
  );
}

/**
 * One side of a leaf. `flipped` is the back face, pre-rotated 180° so it
 * reads correctly once the leaf has turned; both faces hide their backs so
 * only the one facing the viewer paints. The spine-side gradient is what
 * sells the fold — a hint of shadow where the paper curves into the stitch.
 */
function Face({
  page,
  scale,
  renderPage,
  side,
  flipped = false,
  onClick,
}: {
  page: DesignPage | undefined;
  scale: number;
  renderPage: (page: DesignPage, scale: number) => ReactNode;
  side: "left" | "right";
  flipped?: boolean;
  onClick?: () => void;
}) {
  const spine =
    side === "right"
      ? "linear-gradient(to right, rgba(31,26,30,0.16), rgba(31,26,30,0.04) 6%, transparent 14%)"
      : "linear-gradient(to left, rgba(31,26,30,0.16), rgba(31,26,30,0.04) 6%, transparent 14%)";
  return (
    <div
      className={`absolute inset-0 overflow-hidden bg-white ${onClick ? "cursor-pointer" : ""}`}
      style={{
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        transform: flipped ? "rotateY(180deg)" : undefined,
      }}
      onClick={onClick}
    >
      {page && renderPage(page, scale)}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: spine }} />
    </div>
  );
}
