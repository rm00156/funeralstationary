"use client";

import { useEffect, useRef, useState } from "react";

import { PageCanvas } from "@/components/DesignEditor";
import { ARTBOARD_W, type DesignPage } from "@/lib/designEditor";

/** The cover at the handoff's 340px, as a fraction of the artboard. */
const MAX_ZOOM = 340 / ARTBOARD_W;
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
}: {
  name: string;
  views: { label: string; page: DesignPage }[];
}) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(MAX_ZOOM);
  const panelRef = useRef<HTMLDivElement>(null);

  // Shrink the page to fit a narrow panel (phones); never grow past 340px.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const observer = new ResizeObserver(([entry]) => {
      const available = entry.contentRect.width - PANEL_PADDING;
      setZoom(Math.max(0.3, Math.min(MAX_ZOOM, available / ARTBOARD_W)));
    });
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

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
