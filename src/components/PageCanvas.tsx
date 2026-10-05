"use client";

/**
 * The page renderer, on its own so a page that only shows a design (the
 * design page's gallery, /proof-render) doesn't ship the whole editor.
 * DesignEditor.tsx imports it from here like everyone else.
 */

import { createContext, useContext, type ComponentType } from "react";
import {
  Bird,
  Cross,
  Feather,
  Flame,
  Flower2,
  Heart,
  ImagePlus,
  Leaf,
  Music,
  RotateCw,
  Sparkles,
  Star,
  Sun,
  TreeDeciduous,
} from "lucide-react";

import {
  A5_TRIM,
  BLEED_PX,
  DEFAULT_PHOTO_BORDER_COLOR,
  FONT_OPTIONS,
  FRAME_RING_GAP,
  RESIZE_HANDLES,
  pageMetrics,
  frameDepth,
  frameRings,
  photoBorderRadius,
  photoInnerBorderRadius,
  type CanvasElement,
  type ClipartElement,
  type DesignPage,
  type FontFamilyId,
  type FrameElement,
  type FrameVariant,
  type ImageElement,
  type PageTrim,
  type ResizeHandle,
  type ShapeElement,
  type TextElement,
} from "@/lib/designEditor";

export const CLIPARTS: { id: string; label: string; Icon: ComponentType<{ size?: number | string; strokeWidth?: number; color?: string }> }[] = [
  { id: "flower", label: "Flower", Icon: Flower2 },
  { id: "leaf", label: "Leaf", Icon: Leaf },
  { id: "bird", label: "Bird", Icon: Bird },
  { id: "heart", label: "Heart", Icon: Heart },
  { id: "cross", label: "Cross", Icon: Cross },
  { id: "music", label: "Music", Icon: Music },
  { id: "star", label: "Star", Icon: Star },
  { id: "sun", label: "Sun", Icon: Sun },
  { id: "feather", label: "Feather", Icon: Feather },
  { id: "sparkles", label: "Sparkles", Icon: Sparkles },
  { id: "tree", label: "Tree", Icon: TreeDeciduous },
  { id: "candle", label: "Candle", Icon: Flame },
];

/**
 * The trim width of the page being drawn, in base px. An arch window's radius
 * is half its width in px, and its width is a percentage of this — set by
 * PageCanvas and StaticPage so the element views don't each need the trim.
 */
const PageWidthContext = createContext(pageMetrics(A5_TRIM).pageW);

const fontCss = (id: FontFamilyId) =>
  FONT_OPTIONS.find((f) => f.id === id)?.css ?? "var(--font-body)";

/** Active center guides to draw over the canvas while dragging. */
export interface CanvasGuides {
  /** Vertical line at the page's horizontal center (element's x is centered). */
  v: boolean;
  /** Horizontal line at the page's vertical center (element's y is centered). */
  h: boolean;
}

/* ------------------------------------------------------------------ */
/* Canvas                                                              */
/* ------------------------------------------------------------------ */

/**
 * Renders one page's elements plus the print guides. The live editor,
 * /proof-render and the design page's gallery all draw this one component,
 * so the press PDF is a screenshot of exactly what the customer saw — no
 * separate PDF-layout implementation to keep in sync.
 */
export function PageCanvas({
  page,
  trim = A5_TRIM,
  zoom,
  showCut,
  showSafe,
  guides,
  selectedId,
  editingId,
  onSelect,
  onStartDrag,
  onStartEdit,
  onEditText,
  onEndEdit,
  onBackgroundClick,
  editLocked = false,
}: {
  page: DesignPage;
  /** The page's trim — the document's (docTrim) or its product's. */
  trim?: PageTrim;
  zoom: number;
  showCut: boolean;
  showSafe: boolean;
  /**
   * Treat `locked` elements as editable. Only the template authoring editor
   * sets this — on the customer path locked artwork is inert.
   */
  editLocked?: boolean;
  /** Center guide lines to draw while an element is being dragged. */
  guides?: CanvasGuides;
  selectedId: string | null;
  editingId: string | null;
  onSelect: (id: string) => void;
  onStartDrag: (
    event: React.PointerEvent,
    element: CanvasElement,
    mode: "move" | "resize" | "rotate",
    handle?: ResizeHandle,
  ) => void;
  onStartEdit: (element: CanvasElement) => void;
  onEditText: (id: string, text: string) => void;
  onEndEdit: () => void;
  onBackgroundClick: () => void;
}) {
  const { pageW, pageH, artboardW, artboardH } = pageMetrics(trim);
  return (
    <PageWidthContext.Provider value={pageW}>
      <div
        style={{ width: artboardW * zoom, height: artboardH * zoom }}
        className="relative shrink-0"
      >
        <div
          style={{
            width: artboardW,
            height: artboardH,
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            backgroundColor: page.background ?? "#ffffff",
          }}
          /* Nothing selected = the page as it prints, so anything hanging off
             the sheet is clipped away. While an element is selected (which
             includes the whole of a drag) the overhang is shown again, so you
             can see and grab the part that sits outside the artboard. */
          className={`absolute left-0 top-0 shadow-[0_8px_40px_rgba(31,26,30,0.18)] ${
            selectedId ? "" : "overflow-hidden"
          }`}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) onBackgroundClick();
          }}
        >
          {/* trim box — the finished, cut page. Element coordinates (0-100%)
              are measured against this box, not the bleed-inclusive artboard.
              Same background as the artboard itself: bleed is just paper, not
              a visually distinct region — only the cut line marks the trim. */}
          <div
            className="absolute"
            style={{ left: BLEED_PX, top: BLEED_PX, width: pageW, height: pageH }}
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) onBackgroundClick();
            }}
          >
            {page.elements.map((element) => (
              <ElementView
                key={element.id}
                element={element}
                locked={!!element.locked && !editLocked}
                selected={element.id === selectedId}
                editing={element.id === editingId}
                onSelect={() => onSelect(element.id)}
                onStartDrag={onStartDrag}
                onStartEdit={() => onStartEdit(element)}
                onEditText={(text) => onEditText(element.id, text)}
                onEndEdit={onEndEdit}
              />
            ))}

            {showSafe && (
              <div
                aria-hidden
                className="pointer-events-none absolute border border-dashed"
                style={{ inset: 16, borderColor: "#226b3d" }}
              />
            )}

            {/* center snap guides — shown only while dragging near center */}
            {guides?.v && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-1/2 border-l border-dashed"
                style={{ borderColor: "#ec4899" }}
              />
            )}
            {guides?.h && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed"
                style={{ borderColor: "#ec4899" }}
              />
            )}
          </div>

          {/* bleed edge — the true sheet size before trimming */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 border border-outline-variant/60"
          />

          {/* cut line — sits exactly at the trim edge */}
          {showCut && (
            <div
              aria-hidden
              className="pointer-events-none absolute border border-dashed"
              style={{
                left: BLEED_PX,
                top: BLEED_PX,
                width: pageW,
                height: pageH,
                borderColor: "#c2410c",
              }}
            />
          )}
        </div>
      </div>
    </PageWidthContext.Provider>
  );
}

/** Corner placement + cursor for each resize handle. */
const RESIZE_HANDLE_CLASS: Record<ResizeHandle, string> = {
  nw: "-top-2 -left-2 cursor-nwse-resize",
  ne: "-top-2 -right-2 cursor-nesw-resize",
  sw: "-bottom-2 -left-2 cursor-nesw-resize",
  se: "-bottom-2 -right-2 cursor-nwse-resize",
};

const RESIZE_HANDLE_LABELS: Record<ResizeHandle, string> = {
  nw: "Resize from top left",
  ne: "Resize from top right",
  sw: "Resize from bottom left",
  se: "Resize from bottom right",
};

function ElementView({
  element,
  locked,
  selected,
  editing,
  onSelect,
  onStartDrag,
  onStartEdit,
  onEditText,
  onEndEdit,
}: {
  element: CanvasElement;
  locked: boolean;
  selected: boolean;
  editing: boolean;
  onSelect: () => void;
  onStartDrag: (
    event: React.PointerEvent,
    element: CanvasElement,
    mode: "move" | "resize" | "rotate",
    handle?: ResizeHandle,
  ) => void;
  onStartEdit: () => void;
  onEditText: (text: string) => void;
  onEndEdit: () => void;
}) {
  const isText = element.type === "text";
  const baseStyle: React.CSSProperties = {
    left: `${element.x}%`,
    top: `${element.y}%`,
    width: `${element.w}%`,
    height: isText ? "auto" : `${element.h}%`,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
  };

  if (locked) {
    // Inert artwork: no outline, no handles, and pointer events fall through
    // to the page so a click on it deselects rather than grabs.
    return (
      <div className="pointer-events-none absolute select-none" style={baseStyle}>
        <ElementContent
          element={element}
          editing={false}
          onEditText={onEditText}
          onEndEdit={onEndEdit}
        />
      </div>
    );
  }

  return (
    <div
      className={`absolute touch-none select-none ${
        selected
          ? "outline outline-2 outline-offset-1 outline-[#6b2d6a]"
          : "outline outline-1 outline-transparent hover:outline-[#d3c2cd]"
      } ${editing ? "cursor-text" : "cursor-move"}`}
      style={baseStyle}
      onPointerDown={(event) => onStartDrag(event, element, "move")}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onSelect();
        onStartEdit();
      }}
    >
      <ElementContent
        element={element}
        editing={editing}
        onEditText={onEditText}
        onEndEdit={onEndEdit}
      />

      {selected &&
        !editing &&
        RESIZE_HANDLES.map((handle) => (
          <div
            key={handle}
            role="presentation"
            aria-label={RESIZE_HANDLE_LABELS[handle]}
            onPointerDown={(event) => onStartDrag(event, element, "resize", handle)}
            className={`absolute h-4 w-4 touch-none rounded-full border-2 border-white bg-[#6b2d6a] ${RESIZE_HANDLE_CLASS[handle]}`}
          />
        ))}

      {selected && !editing && (
        <div
          role="presentation"
          aria-label="Rotate"
          onPointerDown={(event) => onStartDrag(event, element, "rotate")}
          className="absolute -top-7 left-1/2 flex h-5 w-5 -translate-x-1/2 cursor-grab touch-none items-center justify-center rounded-full border-2 border-white bg-[#6b2d6a] text-white active:cursor-grabbing"
        >
          <RotateCw size={11} aria-hidden />
        </div>
      )}
    </div>
  );
}

function ElementContent({
  element,
  editing,
  onEditText,
  onEndEdit,
}: {
  element: CanvasElement;
  editing: boolean;
  onEditText: (text: string) => void;
  onEndEdit: () => void;
}) {
  if (element.type === "text") {
    return <TextContent element={element} editing={editing} onEditText={onEditText} onEndEdit={onEndEdit} />;
  }
  if (element.type === "image") return <ImageContent element={element} />;
  if (element.type === "shape") return <ShapeContent element={element} />;
  if (element.type === "clipart") {
    return <ClipartContent element={element} />;
  }
  // frame
  return <FrameContent element={element} />;
}

function TextContent({
  element,
  editing,
  onEditText,
  onEndEdit,
}: {
  element: TextElement;
  editing: boolean;
  onEditText: (text: string) => void;
  onEndEdit: () => void;
}) {
  const style: React.CSSProperties = {
    fontFamily: fontCss(element.fontFamily),
    fontSize: element.fontSize,
    fontWeight: element.bold ? 600 : 400,
    fontStyle: element.italic ? "italic" : "normal",
    textAlign: element.align,
    color: element.color,
    letterSpacing: element.letterSpacing,
    textTransform: element.uppercase ? "uppercase" : "none",
    lineHeight: 1.3,
  };

  if (editing) {
    return (
      <textarea
        autoFocus
        value={element.text}
        onChange={(event) => onEditText(event.target.value)}
        onBlur={onEndEdit}
        onPointerDown={(event) => event.stopPropagation()}
        onFocus={(event) => event.target.select()}
        rows={Math.max(1, element.text.split("\n").length)}
        className="block w-full select-text resize-none overflow-hidden bg-transparent outline-none"
        style={style}
      />
    );
  }

  return (
    <div className="whitespace-pre-wrap break-words" style={style}>
      {element.text}
    </div>
  );
}

function ImageContent({ element }: { element: ImageElement }) {
  const pageW = useContext(PageWidthContext);
  const border = element.border;
  const inset = border ? frameDepth(border) : 0;
  const innerRadius = border ? photoInnerBorderRadius(element, inset, pageW) : undefined;
  return (
    <div
      className={`relative h-full w-full overflow-hidden ${
        element.src || border ? "" : "border-2 border-dashed border-[#d3c2cd]"
      } ${element.src ? "" : "bg-[#faf6f8]"}`}
      style={{ borderRadius: photoBorderRadius(element, pageW), padding: inset }}
    >
      <div
        className="h-full w-full overflow-hidden"
        style={{ borderRadius: innerRadius ?? photoBorderRadius(element, pageW) }}
      >
        {element.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={element.src}
            alt=""
            draggable={false}
            className={`h-full w-full ${
              element.fit === "contain" ? "object-contain" : "object-cover"
            }`}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[#81737d]">
            <ImagePlus size={22} aria-hidden />
            <span className="px-3 text-center font-body text-[10px]">
              Double-click to add a photo
            </span>
          </div>
        )}
      </div>
      {border && (
        <div className="pointer-events-none absolute inset-0">
          <FrameRings
            variant={border}
            color={element.borderColor ?? DEFAULT_PHOTO_BORDER_COLOR}
            radiusAt={(offset) => photoInnerBorderRadius(element, offset, pageW)}
          />
        </div>
      )}
    </div>
  );
}

function ShapeContent({ element }: { element: ShapeElement }) {
  if (element.shape === "line") {
    return (
      <div className="flex h-full w-full items-center">
        <div
          className="w-full"
          style={{ height: element.strokeWidth, backgroundColor: element.color }}
        />
      </div>
    );
  }
  return (
    <div
      className="h-full w-full"
      style={{
        border: `${element.strokeWidth}px solid ${element.color}`,
        borderRadius: element.shape === "circle" ? "50%" : 0,
      }}
    />
  );
}

function ClipartContent({ element }: { element: ClipartElement }) {
  const entry = CLIPARTS.find((c) => c.id === element.icon) ?? CLIPARTS[0];
  return (
    <div className="h-full w-full" style={{ color: element.color }}>
      <entry.Icon size="100%" strokeWidth={1.25} aria-hidden />
    </div>
  );
}

function FrameContent({ element }: { element: FrameElement }) {
  return <FrameRings variant={element.variant} color={element.color} />;
}

/**
 * The nested lines of a frame, from the outside in — shared by the page
 * border element and the photo border so the two match. `radiusAt` gives the
 * border-radius for a ring `offset` base-page px inside the outer edge, so a
 * shaped photo window's rings stay parallel to its edge.
 */
function FrameRings({
  variant,
  color,
  radiusAt,
}: {
  variant: FrameVariant;
  color: string;
  radiusAt?: (offset: number) => string | undefined;
}) {
  const rings = frameRings(variant);
  let node: React.ReactNode = null;
  let offset = frameDepth(variant);
  for (let i = rings.length - 1; i >= 0; i -= 1) {
    offset -= rings[i] + FRAME_RING_GAP;
    node = (
      <div
        className="h-full w-full"
        style={{
          border: `${rings[i]}px solid ${color}`,
          padding: FRAME_RING_GAP,
          borderRadius: radiusAt?.(offset),
        }}
      >
        {node}
      </div>
    );
  }
  return node;
}

/* ------------------------------------------------------------------ */
/* Static page (preview modal)                                         */
/* ------------------------------------------------------------------ */

export function StaticPage({
  page,
  trim = A5_TRIM,
  scale,
  plain = false,
}: {
  page: DesignPage;
  trim?: PageTrim;
  scale: number;
  /** No shadow or rounding — for when the page sits inside something that
      already has depth of its own, like a booklet leaf. */
  plain?: boolean;
}) {
  const { pageW, pageH } = pageMetrics(trim);
  return (
    <PageWidthContext.Provider value={pageW}>
      <div
        style={{ width: pageW * scale, height: pageH * scale }}
        className={`relative shrink-0 overflow-hidden ${
          plain ? "" : "rounded-sm shadow-[0_4px_20px_rgba(31,26,30,0.15)]"
        }`}
      >
        <div
          style={{
            width: pageW,
            height: pageH,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            backgroundColor: page.background ?? "#ffffff",
          }}
          className="absolute left-0 top-0"
        >
          {page.elements.map((element) => (
            <div
              key={element.id}
              className="pointer-events-none absolute"
              style={{
                left: `${element.x}%`,
                top: `${element.y}%`,
                width: `${element.w}%`,
                height: element.type === "text" ? "auto" : `${element.h}%`,
                transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
              }}
            >
              <ElementContent
                element={element}
                editing={false}
                onEditText={() => {}}
                onEndEdit={() => {}}
              />
            </div>
          ))}
        </div>
      </div>
    </PageWidthContext.Provider>
  );
}
