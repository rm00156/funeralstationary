"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

import { PAGE_H, PAGE_W, type DesignPage } from "@/lib/designEditor";

/** Slow into the fold, ease out flat — a page, not a swing door. */
const EASE = "cubic-bezier(.4,.1,.2,1)";

/** Resting pose: enough tilt to show the block of pages, not so much you can't read. */
const HOME = { x: 14, y: -24 };
const MAX_TILT = { x: 55, y: 80 };
/** Degrees of orbit per pixel dragged. */
const DRAG_GAIN = { x: 0.3, y: 0.45 };
/** Pointer travel below this is a click on a page, not a drag of the book. */
const DRAG_THRESHOLD = 4;
/** Gap between stacked leaves — the paper thickness you see at the edge. */
const LEAF_GAP = 1.4;

const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

/**
 * A booklet the customer can pick up and leaf through.
 *
 * The model is the physical one — a saddle-stitched booklet is a stack of
 * leaves, and leaf k carries page 2k on its front and page 2k+1 on its back.
 * Turning a leaf rotates it about the spine; what you see open is the back
 * of the last leaf turned (left) and the front of the next (right). A
 * single card falls out of the same model as one leaf with a front and a
 * back, so nothing special-cases it.
 *
 * It is a real object in 3D, not a slideshow with a flip: every leaf sits
 * at its own depth, so the whole book can be dragged to orbit and the edge
 * of the page block shows, and a leaf in flight sweeps through the space
 * between the two stacks the way paper does.
 *
 * Faces are drawn by `renderPage`, which the editor points at its own
 * StaticPage — the booklet never draws a page itself, so it can't drift
 * from the editor or the proof.
 */
export default function BookletPreview({
  pages,
  renderPage,
  /** Largest scale a page renders at; the stage shrinks below it to fit. */
  maxScale = 1,
}: {
  pages: DesignPage[];
  renderPage: (page: DesignPage, scale: number) => ReactNode;
  maxScale?: number;
}) {
  const leafCount = Math.max(1, Math.ceil(pages.length / 2));
  const [turned, setTurned] = useState(0);
  const [orbit, setOrbit] = useState(HOME);
  const [dragging, setDragging] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(maxScale);
  const drag = useRef<{ x: number; y: number; from: typeof HOME; moved: boolean } | null>(null);
  const swallowClick = useRef(false);

  // Fit the open spread (two pages wide, plus room to tilt) to the stage.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const fit = () => {
      const { width, height } = stage.getBoundingClientRect();
      const byWidth = (width * 0.86) / (PAGE_W * 2);
      const byHeight = (height * 0.86) / PAGE_H;
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
        return next < 0 || next > leafCount ? current : next;
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

  /* ----- orbit by dragging anywhere on the stage ----- */

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    drag.current = { x: event.clientX, y: event.clientY, from: orbit, moved: false };
    swallowClick.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!d.moved) {
      d.moved = true;
      setDragging(true);
    }
    setOrbit({
      x: clamp(d.from.x - dy * DRAG_GAIN.x, MAX_TILT.x),
      y: clamp(d.from.y + dx * DRAG_GAIN.y, MAX_TILT.y),
    });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (d?.moved) swallowClick.current = true;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  /** A page click that ends a drag is the drag, not a turn. */
  const tap = (direction: 1 | -1) => () => {
    if (swallowClick.current) {
      swallowClick.current = false;
      return;
    }
    go(direction);
  };

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

  const isHome = orbit.x === HOME.x && orbit.y === HOME.y;

  return (
    <div className="flex h-full min-h-0 flex-col items-center gap-3">
      <div
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`relative flex min-h-0 w-full flex-1 touch-none select-none items-center justify-center overflow-hidden ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{ perspective: 2600 }}
      >
        {/* Ground shadow — outside the orbit so it stays on the "table". */}
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-[50%] bg-on-surface/30 blur-xl transition-transform duration-700 motion-reduce:transition-none"
          style={{
            width: w * (atStart || atEnd ? 1.1 : 2.1),
            height: h * 0.18,
            top: "50%",
            marginTop: h * 0.48,
            transform: `translateX(${shift}px)`,
            transitionTimingFunction: EASE,
          }}
        />

        <div
          className={`relative ${dragging ? "" : "transition-transform duration-500 motion-reduce:transition-none"}`}
          style={{
            width: w * 2,
            height: h,
            transformStyle: "preserve-3d",
            transform: `rotateX(${orbit.x}deg) rotateY(${orbit.y}deg)`,
          }}
        >
          <div
            className="absolute inset-0 transition-transform duration-700 motion-reduce:transition-none"
            style={{
              transformStyle: "preserve-3d",
              transform: `translateX(${shift}px)`,
              transitionTimingFunction: EASE,
            }}
          >
            {Array.from({ length: leafCount }, (_, k) => {
              const isTurned = k < turned;
              // Depth is real, not z-index: unturned leaves stack toward the
              // viewer with the first on top; turned ones the same way with
              // the most recent on top. translateZ runs in the leaf's own
              // frame, so once it has rotated 180° a negative value is what
              // brings it forward.
              const depth = isTurned ? -(k + 1) * LEAF_GAP : (leafCount - k) * LEAF_GAP;
              return (
                <div
                  key={k}
                  className="absolute top-0 transition-transform duration-700 motion-reduce:transition-none"
                  style={{
                    left: w,
                    width: w,
                    height: h,
                    transformOrigin: "left center",
                    transformStyle: "preserve-3d",
                    transform: `rotateY(${isTurned ? -180 : 0}deg) translateZ(${depth}px)`,
                    transitionTimingFunction: EASE,
                  }}
                >
                  <Face
                    page={pages[k * 2]}
                    scale={scale}
                    renderPage={renderPage}
                    side="right"
                    onClick={!isTurned ? tap(1) : undefined}
                  />
                  <Face
                    page={pages[k * 2 + 1]}
                    scale={scale}
                    renderPage={renderPage}
                    side="left"
                    flipped
                    onClick={isTurned ? tap(-1) : undefined}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
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
        <span className="hidden font-body text-xs text-on-surface-variant sm:inline">
          Drag to turn it over
        </span>
        <button
          type="button"
          onClick={() => setOrbit(HOME)}
          disabled={isHome}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-body text-xs text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary disabled:opacity-40"
        >
          <RotateCcw size={13} aria-hidden />
          Reset view
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
      className="absolute inset-0 overflow-hidden bg-white"
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
