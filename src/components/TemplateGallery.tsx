"use client";

import { useEffect, useRef, useState } from "react";

import { PageCanvas } from "@/components/PageCanvas";
import { A5_TRIM, pageMetrics, type DesignPage, type PageTrim } from "@/lib/designEditor";

/**
 * The handoff's cover is 340px wide; every format fits the box an A5 cover
 * that size would fill, so a bookmark is as tall as a booklet, not 4x taller.
 */
const MAX_W = 340;
const MAX_H = (MAX_W * pageMetrics(A5_TRIM).artboardH) / pageMetrics(A5_TRIM).artboardW;
const PANEL_PADDING = 48;

const noop = () => {};

/**
 * A design's own pages, switched by "Front cover / Inside pages / Back cover".
 *
 * It draws them with the editor's PageCanvas — interaction off, guides off —
 * so what the customer previews here is the same markup the editor opens and
 * the press PDF is printed from, not a second rendering of the layout. The
 * pages arrive with stand-in portraits already in their photo windows (see
 * the template page); nothing here is stored.
 */
export default function TemplateGallery({
  name,
  views,
  trim = A5_TRIM,
}: {
  name: string;
  views: { label: string; page: DesignPage }[];
  /** The product's trim — the template's pages are drawn on it. */
  trim?: PageTrim;
}) {
  const { artboardW, artboardH } = pageMetrics(trim);
  const maxZoom = Math.min(MAX_W / artboardW, MAX_H / artboardH);
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(maxZoom);
  const panelRef = useRef<HTMLDivElement>(null);

  // Shrink the page to fit a narrow panel (phones); never grow past the cover box.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const observer = new ResizeObserver(([entry]) => {
      const available = entry.contentRect.width - PANEL_PADDING;
      setZoom(Math.max(0.1, Math.min(maxZoom, available / artboardW)));
    });
    observer.observe(panel);
    return () => observer.disconnect();
  }, [maxZoom, artboardW]);

  const view = views[active] ?? views[0];
  if (!view) return null;

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={panelRef}
        className="flex min-h-[420px] items-center justify-center overflow-hidden rounded-2xl bg-mist-3 py-10 sm:min-h-[600px]"
      >
        <div
          role="img"
          aria-label={`${name} design, ${view.label.toLowerCase()}`}
          className="pointer-events-none select-none"
        >
          <PageCanvas
            page={view.page}
            trim={trim}
            zoom={zoom}
            showCut={false}
            showSafe={false}
            selectedId={null}
            editingId={null}
            onSelect={noop}
            onStartDrag={noop}
            onStartEdit={noop}
            onEditText={noop}
            onEndEdit={noop}
            onBackgroundClick={noop}
          />
        </div>
      </div>
      <div role="group" aria-label="Choose a page to preview" className="flex flex-wrap gap-3">
        {views.map((item, index) => (
          <button
            key={item.label}
            type="button"
            className="chip rounded-lg px-[18px]"
            aria-pressed={index === active}
            onClick={() => setActive(index)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
