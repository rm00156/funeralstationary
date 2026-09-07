"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bird,
  Ban,
  Bold,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Circle,
  ClipboardPaste,
  Copy,
  Cross,
  Eye,
  Feather,
  FileDown,
  Flame,
  Flower2,
  Heart,
  Home,
  Image as ImageIcon,
  ImagePlus,
  Italic,
  Layers,
  LayoutGrid,
  LayoutTemplate,
  Leaf,
  Lightbulb,
  Lock,
  LockOpen,
  Maximize2,
  Minus,
  Music,
  Package,
  Pipette,
  Plus,
  Redo2,
  RotateCw,
  Save,
  Shapes,
  Share2,
  ShoppingCart,
  Sparkles,
  Square,
  Star,
  Sun,
  Trash2,
  TreeDeciduous,
  Type,
  Undo2,
  UploadCloud,
  X,
} from "lucide-react";

import {
  ARTBOARD_H,
  ARTBOARD_W,
  BLEED_PX,
  FONT_OPTIONS,
  frameDepth,
  frameRings,
  imageShape,
  photoBorderRadius,
  photoInnerBorderRadius,
  DEFAULT_PHOTO_BORDER_COLOR,
  FRAME_RING_GAP,
  FRAME_VARIANTS,
  INK_PALETTE,
  PAGE_BACKGROUND_PALETTE,
  PAGE_H,
  PAGE_W,
  RESIZE_HANDLES,
  instantiateLayout,
  makeStarterDoc,
  makeTemplateLayout,
  resizeBox,
  templateAccent,
  templatePageLabel,
  toTemplateLayout,
  uid,
  withPageCount,
  type CanvasElement,
  type ClipartElement,
  type DesignDoc,
  type DesignPage,
  type FontFamilyId,
  type FrameElement,
  type ImageElement,
  type FrameVariant,
  type PhotoShape,
  type ProofRequest,
  type ResizeHandle,
  type ShapeElement,
  type TextElement,
} from "@/lib/designEditor";
import BookletPreview from "@/components/BookletPreview";
import PreOrderCheckDialog, {
  parsePreOrderCheck,
  type PreOrderCheck,
} from "@/components/PreOrderCheckDialog";
import {
  defaultSelection,
  formatPence,
  getQuote,
  type PricingData,
} from "@/lib/orderOfServicePricing";
import type { Template } from "@/lib/templates";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

type TabId =
  | "product"
  | "templates"
  | "text"
  | "cliparts"
  | "photos"
  | "elements"
  | "layers";

const TABS: { id: TabId; label: string; Icon: ComponentType<{ size?: number | string }> }[] = [
  { id: "product", label: "Product", Icon: Package },
  { id: "templates", label: "Templates", Icon: LayoutTemplate },
  { id: "text", label: "Text", Icon: Type },
  { id: "cliparts", label: "Cliparts", Icon: Star },
  { id: "photos", label: "Photos", Icon: ImageIcon },
  { id: "elements", label: "Elements", Icon: Shapes },
  { id: "layers", label: "Layers", Icon: Layers },
];

const CLIPARTS: { id: string; label: string; Icon: ComponentType<{ size?: number | string; strokeWidth?: number; color?: string }> }[] = [
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

const fontCss = (id: FontFamilyId) =>
  FONT_OPTIONS.find((f) => f.id === id)?.css ?? "var(--font-body)";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Distance (screen px) within which a dragged element snaps to a guide. */
const SNAP_PX = 6;

/** Active center guides to draw over the canvas while dragging. */
interface CanvasGuides {
  /** Vertical line at the page's horizontal center (element's x is centered). */
  v: boolean;
  /** Horizontal line at the page's vertical center (element's y is centered). */
  h: boolean;
}
const NO_GUIDES: CanvasGuides = { v: false, h: false };

/* ------------------------------------------------------------------ */
/* Pure document helpers                                               */
/* ------------------------------------------------------------------ */

function patchElement(
  doc: DesignDoc,
  pageIndex: number,
  elementId: string,
  patch: (element: CanvasElement) => CanvasElement,
): DesignDoc {
  return {
    ...doc,
    pages: doc.pages.map((page, index) =>
      index === pageIndex
        ? {
            ...page,
            elements: page.elements.map((element) =>
              element.id === elementId ? patch(element) : element,
            ),
          }
        : page,
    ),
  };
}

function withElements(
  doc: DesignDoc,
  pageIndex: number,
  elements: CanvasElement[],
): DesignDoc {
  return {
    ...doc,
    pages: doc.pages.map((page, index) =>
      index === pageIndex ? { ...page, elements } : page,
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Editor                                                              */
/* ------------------------------------------------------------------ */

export default function DesignEditor({
  template,
  productId,
  productLabel,
  templates,
  pricing,
  initialLayout,
  templateAuthoring,
  savedDesign,
}: {
  template: Template;
  productId: string;
  productLabel: string;
  /** The published template catalogue, for the template picker panel. */
  templates: Template[];
  /** This product's pricing options, loaded from the DB by the page. */
  pricing: PricingData;
  /** The initial template's authored layout (templates.layout), if any. */
  initialLayout?: DesignPage[] | null;
  /**
   * Admin template-authoring mode: the document IS the template's layout.
   * Saves PUT /api/admin/templates/:slug/layout instead of /api/designs, and
   * customer-only chrome (cart, quote, paper, the template picker) is hidden.
   *
   * Saves land in templates.draft_layout, never the live layout — an admin can
   * rework a published template without customers seeing half-finished pages.
   * The Publish button promotes the draft.
   */
  templateAuthoring?: {
    slug: string;
    /** The draft if one exists, otherwise the published layout. */
    initialPages: DesignPage[] | null;
    /** Whether the editor opened on unpublished changes. */
    hasDraftLayout: boolean;
  };
  /** An existing design loaded server-side from ?design=<id>, if any. */
  savedDesign?: {
    id: string;
    name: string;
    doc: DesignDoc;
    pagesOptionId: string;
    paperId: string;
  };
}) {
  const authoring = !!templateAuthoring;
  // The page-count option and the document's page count must agree from the
  // first render (autosave validates doc.pages.length against the option), so
  // both initialisers derive from this one resolution.
  // Authoring always works on exactly cover/middle/back, normalising any
  // older layout that was authored at a different length.
  const startingPages = templateAuthoring
    ? (toTemplateLayout(templateAuthoring.initialPages) ?? makeTemplateLayout(template))
    : savedDesign
      ? null
      : (initialLayout ?? null);
  const initialPageOption =
    (savedDesign
      ? pricing.pages.find((option) => option.id === savedDesign.pagesOptionId)
      : startingPages
        ? pricing.pages.find((option) => option.pages === startingPages.length)
        : undefined) ?? pricing.pages[0];
  const [doc, setDoc] = useState<DesignDoc>(() => {
    if (savedDesign && !templateAuthoring) return savedDesign.doc;
    if (startingPages) {
      // Authoring keeps the authored length even when no page option matches;
      // a customer document is reconciled to its page option.
      const pageCount = authoring
        ? startingPages.length
        : (initialPageOption?.pages ?? startingPages.length);
      return instantiateLayout(template.id, startingPages, pageCount);
    }
    return makeStarterDoc(template, initialPageOption?.pages ?? 4);
  });
  const [history, setHistory] = useState<DesignDoc[]>([]);
  const [future, setFuture] = useState<DesignDoc[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("product");
  const [zoom, setZoom] = useState(0.85);
  const [showCut, setShowCut] = useState(true);
  const [showSafe, setShowSafe] = useState(true);
  const [pagesOptionId, setPagesOptionId] = useState(
    savedDesign?.pagesOptionId ?? initialPageOption?.id ?? "",
  );
  const [paperId, setPaperId] = useState(
    savedDesign?.paperId ?? pricing.paper[0]?.id ?? "",
  );
  const [uploads, setUploads] = useState<string[]>([]);
  const [designId, setDesignId] = useState<string | null>(savedDesign?.id ?? null);
  /**
   * The template currently applied to the cover. Seeded from the `template`
   * prop (which the server already resolves from a saved design's own
   * templateId), then kept in sync by applyTemplate — the prop itself never
   * changes, so anything that read it directly would go stale the moment a
   * different template was picked.
   */
  const [activeTemplate, setActiveTemplate] = useState<Template>(template);
  // Renaming happens on /designs; a new design just takes the template's name.
  const [designName, setDesignName] = useState(savedDesign?.name ?? template.name);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  /** Authoring only: the draft holds changes customers can't see yet. */
  const [draftPending, setDraftPending] = useState(
    templateAuthoring?.hasDraftLayout ?? false,
  );
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState<"pages" | "booklet">("pages");
  const [tipsOpen, setTipsOpen] = useState(true);
  const [proofState, setProofState] = useState<"idle" | "generating">("idle");
  const [addingToCart, setAddingToCart] = useState(false);
  /**
   * The pre-order check the server refused the add with — an empty photo
   * window, or wording still at the template's default. Shown as a dialog so
   * the customer can fix it here rather than discover it after paying.
   */
  const [preOrderCheck, setPreOrderCheck] = useState<PreOrderCheck | null>(null);
  const router = useRouter();
  /** Whether the active panel is open as a bottom sheet (mobile only). */
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  /** Center guide lines shown while dragging an element (see startDrag). */
  const [guides, setGuides] = useState<CanvasGuides>(NO_GUIDES);

  const clipboardRef = useRef<CanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<string | null>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  const page = doc.pages[Math.min(pageIndex, doc.pages.length - 1)];
  const selected =
    page?.elements.find((element) => element.id === selectedId) ?? null;

  // Authoring a template hides the picker — applying a template on top of the
  // layout being authored would overwrite the very thing being made.
  const visibleTabs = authoring ? TABS.filter(({ id }) => id !== "templates") : TABS;

  /* ------------------------------ persistence ----------------------- */

  const flash = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  /**
   * Persist to the server. A design row is created lazily on the first save
   * rather than on page load, so simply opening the editor never litters the
   * database; once created we swap the id into the URL so a refresh (or a
   * shared link) reopens the same design.
   */
  const persist = useCallback(
    async (options: { silent?: boolean } = {}): Promise<string | null> => {
      setSaveState("saving");
      try {
        // Authoring mode: the document IS the template layout — save it to
        // the template row's draft, never to /api/designs. Nothing reaches
        // customers until the draft is published.
        if (templateAuthoring) {
          const response = await fetch(
            `/api/admin/templates/${templateAuthoring.slug}/layout`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pages: doc.pages }),
            },
          );
          if (!response.ok) throw new Error(await response.text());
          setSaveState("saved");
          setDraftPending(true);
          if (!options.silent) flash("Draft saved — not visible to customers yet");
          return null;
        }

        const payload = {
          doc,
          pagesOptionId,
          paperId,
          name: designName,
          templateId: activeTemplate.id,
        };
        const response = designId
          ? await fetch(`/api/designs/${designId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch("/api/designs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...payload, productId }),
            });

        if (!response.ok) throw new Error(await response.text());
        const saved = (await response.json()) as { id: string };

        if (!designId) setDesignId(saved.id);
        setSaveState("saved");
        if (!options.silent) flash("Design saved to your account");
        return designId ?? saved.id;
      } catch {
        setSaveState("error");
        if (!options.silent) flash("Could not save — please try again");
        return null;
      }
    },
    [doc, pagesOptionId, paperId, designName, designId, activeTemplate.id, productId, templateAuthoring, flash],
  );

  const saveDesign = () => {
    void persist();
  };

  /**
   * Save first (the row may not exist yet — see persist), then put the
   * design in the basket and go there. Quantity, size and colour are chosen
   * on the basket page; pages and paper come from the design itself.
   */
  const addToCart = useCallback(async (acknowledgeDefaults = false) => {
    if (authoring) return;
    setAddingToCart(true);
    const id = await persist({ silent: true });
    if (!id) {
      setAddingToCart(false);
      flash("Could not save your design — please try again");
      return;
    }
    try {
      const response = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId: id, acknowledgeDefaults }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        // A refused pre-order check is not an error to apologise for — it is a
        // list of things the customer can put right, so show them the list.
        const check = parsePreOrderCheck(body);
        if (check) {
          setAddingToCart(false);
          setPreOrderCheck(check);
          return;
        }
        throw new Error(body.error || "Could not add to your basket — please try again");
      }
      setPreOrderCheck(null);
      window.dispatchEvent(new Event("tfs:cart-changed"));
      router.push("/cart");
    } catch (error) {
      setAddingToCart(false);
      flash(error instanceof Error ? error.message : "Could not add to your basket — please try again");
    }
  }, [authoring, persist, flash, router]);

  /**
   * Authoring only: promote the draft to the live layout. Saves first, so
   * whatever is on screen — including edits the 1.5s autosave hasn't flushed
   * — is what gets published.
   */
  const publishLayout = async () => {
    if (!templateAuthoring) return;
    setPublishing(true);
    try {
      await persist({ silent: true });
      const response = await fetch(
        `/api/admin/templates/${templateAuthoring.slug}/layout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "publish" }),
        },
      );
      if (!response.ok) throw new Error(await response.text());
      setDraftPending(false);
      flash("Layout published — customers see it now");
    } catch {
      flash("Could not publish — please try again");
    } finally {
      setPublishing(false);
    }
  };

  /**
   * Once a design exists, its id is the whole address — the row owns its own
   * template and product, and both can change from inside the editor. A
   * lingering ?template=/?product= would start lying the moment a different
   * template was applied, so they're dropped here (they only ever seed a new
   * design, from /templates).
   */
  useEffect(() => {
    if (!designId) return;
    const url = new URL(window.location.href);
    const alreadyClean =
      url.searchParams.get("design") === designId &&
      !url.searchParams.has("template") &&
      !url.searchParams.has("product");
    if (alreadyClean) return;
    url.search = "";
    url.searchParams.set("design", designId);
    window.history.replaceState(null, "", url);
  }, [designId]);

  /** Debounced autosave — the "saves automatically as you go" promise. */
  const firstRender = useRef(true);
  // Lets the unmount-flush effect below call the latest persist without
  // depending on it directly — persist's identity changes on every edit, and
  // an effect keyed on it would fire its "cleanup" on every keystroke, not
  // just on a real unmount.
  const persistRef = useRef(persist);
  useEffect(() => {
    persistRef.current = persist;
  }, [persist]);
  const pendingAutosaveRef = useRef(false);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    pendingAutosaveRef.current = true;
    const timer = window.setTimeout(() => {
      pendingAutosaveRef.current = false;
      void persistRef.current({ silent: true });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [doc, pagesOptionId, paperId]);

  // Flush a still-pending autosave when the editor unmounts — e.g. clicking
  // "Templates" or navigating back right after an edit, before the 1.5s
  // debounce above has fired — so that edit isn't silently dropped.
  useEffect(() => {
    return () => {
      if (pendingAutosaveRef.current) {
        pendingAutosaveRef.current = false;
        void persistRef.current({ silent: true });
      }
    };
  }, []);

  /* ------------------------------ history --------------------------- */

  const commit = useCallback(
    (next: DesignDoc) => {
      setHistory((h) => [...h.slice(-49), doc]);
      setFuture([]);
      setDoc(next);
      setPageIndex((index) => Math.min(index, next.pages.length - 1));
    },
    [doc],
  );

  /** Push the current doc to history without changing it (start of a drag). */
  const snapshot = useCallback(() => {
    setHistory((h) => [...h.slice(-49), doc]);
    setFuture([]);
  }, [doc]);

  const undo = useCallback(() => {
    if (!history.length) return;
    const previous = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setFuture((f) => [doc, ...f]);
    setDoc(previous);
    setPageIndex((index) => Math.min(index, previous.pages.length - 1));
    setSelectedId(null);
    setEditingId(null);
  }, [history, doc]);

  const redo = useCallback(() => {
    if (!future.length) return;
    const [next, ...rest] = future;
    setFuture(rest);
    setHistory((h) => [...h, doc]);
    setDoc(next);
    setPageIndex((index) => Math.min(index, next.pages.length - 1));
    setSelectedId(null);
    setEditingId(null);
  }, [future, doc]);

  /* ------------------------------ element ops ------------------------ */

  const addElement = useCallback(
    (element: CanvasElement) => {
      commit(withElements(doc, pageIndex, [...page.elements, element]));
      setSelectedId(element.id);
    },
    [commit, doc, page, pageIndex],
  );

  const setPageBackground = useCallback(
    (background: string | undefined) => {
      commit({
        ...doc,
        pages: doc.pages.map((p, index) => (index === pageIndex ? { ...p, background } : p)),
      });
    },
    [commit, doc, pageIndex],
  );

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    commit(
      withElements(
        doc,
        pageIndex,
        page.elements.filter((element) => element.id !== selectedId),
      ),
    );
    setSelectedId(null);
    setEditingId(null);
  }, [commit, doc, page, pageIndex, selectedId]);

  const copySelected = useCallback(() => {
    if (!selected) return;
    clipboardRef.current = selected;
    flash("Copied");
  }, [selected, flash]);

  const pasteClipboard = useCallback(() => {
    const copied = clipboardRef.current;
    if (!copied) return;
    addElement({
      ...copied,
      id: uid(copied.type),
      x: clamp(copied.x + 3, 0, 92),
      y: clamp(copied.y + 3, 0, 94),
    });
  }, [addElement]);

  const updateSelected = useCallback(
    (patch: Partial<CanvasElement>, options?: { commit?: boolean }) => {
      if (!selectedId) return;
      const next = patchElement(
        doc,
        pageIndex,
        selectedId,
        (element) => ({ ...element, ...patch }) as CanvasElement,
      );
      if (options?.commit === false) setDoc(next);
      else commit(next);
    },
    [commit, doc, pageIndex, selectedId],
  );

  /* ------------------------------ keyboard --------------------------- */

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing =
        target.tagName === "TEXTAREA" ||
        target.tagName === "INPUT" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;
      if (event.key === "Escape") {
        setEditingId(null);
        if (!typing) setSelectedId(null);
        setPreview(false);
        return;
      }
      if (typing) return;
      const meta = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (meta && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (meta && key === "c") {
        copySelected();
      } else if (meta && key === "v") {
        pasteClipboard();
      } else if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
        event.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, copySelected, pasteClipboard, deleteSelected, selectedId]);

  /* ------------------------------ drag / resize ----------------------- */

  const startDrag = (
    event: React.PointerEvent,
    element: CanvasElement,
    mode: "move" | "resize" | "rotate",
    handle: ResizeHandle = "se",
  ) => {
    if (editingId === element.id) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(element.id);
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = { ...element };
    const activePage = pageIndex;
    let moved = false;

    // The zoom level cannot change mid-drag, so capturing it here is safe.
    const dragZoom = zoom;

    if (mode === "rotate") {
      // Center of the element on screen — stays fixed for the whole drag,
      // since a CSS rotate() pivots around the element's own center.
      const rect = (event.currentTarget as HTMLElement).parentElement?.getBoundingClientRect();
      const center = rect
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        : { x: startX, y: startY };
      const SNAP_DEG = [0, 45, 90, 135, 180, 225, 270, 315];
      const onRotateMove = (move: PointerEvent) => {
        if (!moved) {
          moved = true;
          snapshot();
        }
        const dx = move.clientX - center.x;
        const dy = move.clientY - center.y;
        // 0deg = handle straight up; positive = clockwise, matching CSS rotate().
        let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        angle = ((angle % 360) + 360) % 360;
        for (const snapTarget of SNAP_DEG) {
          if (Math.abs(angle - snapTarget) < 4 || Math.abs(angle - snapTarget - 360) < 4) {
            angle = snapTarget % 360;
            break;
          }
        }
        setDoc((current) =>
          patchElement(current, activePage, element.id, (el) => ({ ...el, rotation: angle })),
        );
      };
      const onRotateUp = () => {
        window.removeEventListener("pointermove", onRotateMove);
        window.removeEventListener("pointerup", onRotateUp);
      };
      window.addEventListener("pointermove", onRotateMove);
      window.addEventListener("pointerup", onRotateUp);
      return;
    }

    const onMove = (move: PointerEvent) => {
      if (!moved) {
        if (Math.hypot(move.clientX - startX, move.clientY - startY) < 3) return;
        moved = true;
        snapshot();
      }
      const dx = ((move.clientX - startX) / (PAGE_W * dragZoom)) * 100;
      const dy = ((move.clientY - startY) / (PAGE_H * dragZoom)) * 100;

      if (mode === "move") {
        let nextX = clamp(origin.x + dx, -30, 96);
        let nextY = clamp(origin.y + dy, -20, 97);

        // Snap the element's center to the page center when close, and show
        // a guide line while it's snapped. The snap distance is defined in
        // screen pixels (not page percent) so it feels the same at any zoom
        // level. Text elements store h=0 (their height is auto, set by
        // content) — for them the horizontal guide snaps the top edge to
        // center rather than a true vertical center, since the rendered
        // height isn't known during drag.
        const snapThresholdX = (SNAP_PX / (PAGE_W * dragZoom)) * 100;
        const snapThresholdY = (SNAP_PX / (PAGE_H * dragZoom)) * 100;
        const centerX = nextX + origin.w / 2;
        const centerY = nextY + origin.h / 2;
        const snapV = Math.abs(centerX - 50) <= snapThresholdX;
        const snapH = Math.abs(centerY - 50) <= snapThresholdY;
        if (snapV) nextX = 50 - origin.w / 2;
        if (snapH) nextY = 50 - origin.h / 2;
        setGuides({ v: snapV, h: snapH });

        setDoc((current) =>
          patchElement(current, activePage, element.id, (el) => ({
            ...el,
            x: nextX,
            y: nextY,
          })),
        );
        return;
      }

      setDoc((current) =>
        patchElement(current, activePage, element.id, (el) => {
          const isText = el.type === "text" && origin.type === "text";
          const box = resizeBox(origin, handle, dx, dy, {
            autoHeight: isText,
            rotation: origin.rotation ?? 0,
          });
          if (el.type === "text" && origin.type === "text") {
            const fontSize = Math.max(
              6,
              Math.round(origin.fontSize * (box.w / origin.w)),
            );
            // `y` still moves for a rotated box: the centre pivot shifts it
            // even though the height itself is content-driven.
            return { ...el, x: box.x, y: box.y, w: box.w, fontSize };
          }
          return { ...el, ...box };
        }),
      );
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setGuides(NO_GUIDES);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  /* ------------------------------ photos ------------------------------ */

  /**
   * Upload a photo and return its public URL.
   *
   * The bytes go straight from the browser to object storage via a presigned
   * PUT — they never pass through a Route Handler, which keeps uploads clear
   * of Vercel's 4.5MB serverless request-body cap and keeps the saved
   * DesignDoc small enough to autosave (it stores a URL, not base64).
   */
  const uploadPhoto = async (file: File): Promise<string> => {
    const reserve = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentType: file.type,
        byteSize: file.size,
        designId,
      }),
    });
    if (!reserve.ok) {
      const { error } = (await reserve.json().catch(() => ({}))) as { error?: string };
      throw new Error(error ?? "Could not start the upload");
    }
    const { uploadUrl, url } = (await reserve.json()) as {
      uploadUrl: string;
      url: string;
    };

    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!put.ok) throw new Error("Could not upload the photo");
    return url;
  };

  const readFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const targetId = replaceTargetRef.current;
    replaceTargetRef.current = null;

    void (async () => {
      const chosen = Array.from(files);
      try {
        const urls = await Promise.all(chosen.map((file) => uploadPhoto(file)));
        setUploads((current) => [...urls, ...current]);

        const [first] = urls;
        if (!first) return;
        if (targetId) {
          commit(
            patchElement(doc, pageIndex, targetId, (el) =>
              el.type === "image" ? { ...el, src: first } : el,
            ),
          );
        } else {
          addElement({
            id: uid("image"),
            type: "image",
            src: first,
            x: 30,
            y: 30,
            w: 40,
            h: 28,
          });
        }
      } catch (error) {
        flash(error instanceof Error ? error.message : "Could not upload the photo");
      }
    })();
  };

  const openPhotoPicker = (replaceId?: string) => {
    replaceTargetRef.current = replaceId ?? null;
    fileInputRef.current?.click();
  };

  const addPhotoPlaceholder = () => {
    addElement({
      id: uid("image"),
      type: "image",
      src: null,
      shape: "oval",
      x: 30,
      y: 30,
      w: 40,
      h: 28,
    });
  };

  /* ------------------------------ misc actions ------------------------ */

  const addText = (preset: "heading" | "subheading" | "body" | "script") => {
    const presets: Record<typeof preset, Partial<TextElement>> = {
      heading: { text: "Add a heading", fontFamily: "display", fontSize: 28 },
      subheading: { text: "Add a subheading", fontFamily: "display", fontSize: 18 },
      body: { text: "Add a little body text", fontFamily: "body", fontSize: 13 },
      script: { text: "With love", fontFamily: "script", fontSize: 34 },
    };
    addElement({
      id: uid("text"),
      type: "text",
      align: "center",
      color: "#1f1a1e",
      x: 15,
      y: 40,
      w: 70,
      h: 0,
      fontFamily: "body",
      fontSize: 14,
      ...presets[preset],
    } as TextElement);
  };

  const applyTemplate = async (next: Template) => {
    // A template with an admin-authored layout is a genuinely different
    // multi-page design, so applying it replaces the whole document (behind a
    // confirm). Without one, keep the historical behaviour: regenerate just
    // the cover and leave the customer's other pages alone.
    let layout: DesignPage[] | null = null;
    try {
      const response = await fetch(`/api/templates/${next.id}/layout`);
      if (response.ok) {
        layout = ((await response.json()) as { layout: DesignPage[] | null }).layout;
      }
    } catch {
      // Treat a failed fetch like an unauthored template.
    }

    if (layout && layout.length > 0) {
      const confirmed = window.confirm(
        `Apply “${next.name}”? This replaces every page of your design with the template's layout.`,
      );
      if (!confirmed) return;
      // Keep the page-count invariant: adopt the layout's own length when a
      // page option matches it, otherwise fit the layout to the current one.
      const matchingOption = pricing.pages.find(
        (option) => option.pages === layout.length,
      );
      if (matchingOption) setPagesOptionId(matchingOption.id);
      commit(
        instantiateLayout(
          next.id,
          layout,
          matchingOption ? layout.length : doc.pages.length,
        ),
      );
      flash(`Applied “${next.name}”`);
    } else {
      const starter = makeStarterDoc(next, doc.pages.length);
      // templateId has to move with the cover: it's what gets persisted to
      // designs.template_id, so leaving it behind would save the design under
      // whichever template happened to be open first.
      commit({
        ...withElements(doc, 0, starter.pages[0].elements),
        templateId: next.id,
      });
      flash(`Applied “${next.name}” to your cover`);
    }

    setActiveTemplate(next);
    // Follow the template name only while it's still the auto-derived one —
    // a name the user set themselves on /designs is left alone.
    setDesignName((current) => (current === activeTemplate.name ? next.name : current));
    setPageIndex(0);
    setSelectedId(null);
  };

  const setPageCount = (optionId: string) => {
    const option = pricing.pages.find((o) => o.id === optionId);
    if (!option) return;
    setPagesOptionId(optionId);
    commit(withPageCount(doc, option.pages));
    setPageIndex((current) => Math.min(current, option.pages - 1));
  };

  const fitZoom = useCallback(() => {
    const area = canvasAreaRef.current;
    if (!area) return;
    const fit = Math.min(
      (area.clientWidth - 40) / ARTBOARD_W,
      (area.clientHeight - 96) / ARTBOARD_H,
    );
    setZoom(clamp(fit, 0.3, 2));
  }, []);

  // Fit the page to whatever screen we open on (phones especially).
  useEffect(() => {
    fitZoom();
  }, [fitZoom]);

  const shareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      flash("Link copied to clipboard");
    } catch {
      flash("Could not copy the link");
    }
  };

  const downloadProof = async () => {
    setProofState("generating");
    try {
      const response = await fetch("/api/proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc } satisfies ProofRequest),
      });
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${activeTemplate.id}-proof.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      setProofState("idle");
    } catch {
      setProofState("idle");
      flash("Could not generate the proof — please try again");
    }
  };

  const quote = useMemo(
    () =>
      getQuote(pricing, {
        ...defaultSelection(pricing),
        pages: pagesOptionId,
        paper: paperId,
      }),
    [pricing, pagesOptionId, paperId],
  );

  const reorderSelectedWith = (from: number, to: number) => {
    if (to < 0 || to >= page.elements.length) return;
    const elements = [...page.elements];
    const [moved] = elements.splice(from, 1);
    elements.splice(to, 0, moved);
    commit(withElements(doc, pageIndex, elements));
  };

  /* ------------------------------ render ------------------------------ */

  return (
    <div className="flex h-dvh flex-col bg-surface-container-low text-on-surface">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          readFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {/* ------------------------------ top bar ------------------------ */}
      <header className="flex items-center gap-1 border-b border-outline-variant/40 bg-surface-container-lowest px-3 py-2">
        <Link
          href={authoring ? "/admin/templates" : "/templates"}
          className="flex items-center gap-2 rounded-lg border border-outline-variant/60 px-2.5 py-2 font-body text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary sm:px-3"
        >
          <Home size={16} aria-hidden />
          <span className="hidden sm:inline">{authoring ? "Templates" : "Home"}</span>
        </Link>

        <div className="mx-1 h-7 w-px bg-outline-variant/50 sm:mx-2" aria-hidden />

        <ToolbarButton label="Undo" disabled={!history.length} onClick={undo}>
          <Undo2 size={18} aria-hidden />
        </ToolbarButton>
        <ToolbarButton label="Redo" disabled={!future.length} onClick={redo}>
          <Redo2 size={18} aria-hidden />
        </ToolbarButton>
        <div className="hidden items-center gap-1 sm:flex">
          <ToolbarButton label="Copy" disabled={!selected} onClick={copySelected}>
            <Copy size={18} aria-hidden />
          </ToolbarButton>
          <ToolbarButton label="Paste" onClick={pasteClipboard}>
            <ClipboardPaste size={18} aria-hidden />
          </ToolbarButton>
        </div>

        <div className="mx-1 h-7 w-px bg-outline-variant/50 sm:mx-2" aria-hidden />

        <ToolbarButton label="Add text" onClick={() => addText("body")}>
          <Type size={18} aria-hidden />
        </ToolbarButton>
        <ToolbarButton label="Add photo" onClick={() => openPhotoPicker()}>
          <ImagePlus size={18} aria-hidden />
        </ToolbarButton>
        {authoring && (
          <ToolbarButton label="Add photo placeholder" onClick={() => addPhotoPlaceholder()}>
            <ImageIcon size={18} aria-hidden />
          </ToolbarButton>
        )}

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <span
            aria-live="polite"
            className="hidden font-body text-xs text-on-surface-variant lg:inline"
          >
            {saveState === "saving"
              ? "Saving…"
              : saveState === "saved"
                ? authoring
                  ? "Draft saved"
                  : "All changes saved"
                : saveState === "error"
                  ? "Not saved"
                  : ""}
          </span>
          {authoring && draftPending && (
            <span className="hidden rounded-full bg-surface-container px-3 py-1 font-body text-xs font-medium text-on-surface-variant lg:inline">
              Unpublished changes
            </span>
          )}
          <button
            type="button"
            onClick={saveDesign}
            disabled={saveState === "saving"}
            className="flex items-center gap-2 rounded-lg bg-secondary p-2.5 font-body text-sm font-medium text-on-secondary transition-colors hover:bg-on-secondary-container disabled:opacity-60 sm:px-4"
          >
            <Save size={16} aria-hidden />
            <span className="hidden md:inline">
              {authoring ? "Save Draft" : "Save Design"}
            </span>
          </button>
          {authoring && (
            <button
              type="button"
              onClick={() => void publishLayout()}
              disabled={!draftPending || publishing || saveState === "saving"}
              title={
                draftPending
                  ? "Make this layout live for customers"
                  : "No unpublished changes"
              }
              className="flex items-center gap-2 rounded-lg bg-primary-container p-2.5 font-body text-sm font-medium text-white transition-colors hover:bg-primary disabled:opacity-40 sm:px-4"
            >
              <UploadCloud size={16} aria-hidden />
              <span className="hidden md:inline">
                {publishing ? "Publishing…" : "Publish"}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={shareLink}
            aria-label="Copy a link to this design"
            className="hidden rounded-lg p-2.5 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary sm:block"
          >
            <Share2 size={18} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setPreview(true)}
            className="flex items-center gap-2 rounded-lg p-2.5 font-body text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary sm:px-3"
          >
            <Eye size={16} aria-hidden />
            <span className="hidden md:inline">Preview</span>
          </button>
          {!authoring && (
            <button
              type="button"
              onClick={() => void addToCart()}
              disabled={addingToCart}
              aria-label="Add to basket"
              className="flex items-center gap-2 rounded-lg bg-primary-container p-2.5 font-body text-sm font-medium text-white transition-colors hover:bg-primary disabled:opacity-60 sm:px-4"
            >
              <ShoppingCart size={16} aria-hidden className="md:hidden" />
              <span className="hidden md:inline">{addingToCart ? "Adding…" : "Add to basket"}</span>
              <ArrowRight size={16} aria-hidden className="hidden md:block" />
            </button>
          )}
        </div>
      </header>

      {/* --------------------- contextual selection bar ----------------- */}
      {selected && (
        <div className="flex items-center gap-1 overflow-x-auto border-b border-outline-variant/40 bg-surface-container-lowest px-3 py-1.5">
          {selected.type === "text" && (
            <>
              <select
                aria-label="Font"
                value={selected.fontFamily}
                onChange={(event) =>
                  updateSelected({ fontFamily: event.target.value as FontFamilyId })
                }
                className="rounded-md border border-outline-variant/60 bg-surface-container-lowest px-2 py-1.5 font-body text-sm"
              >
                {FONT_OPTIONS.map((font) => (
                  <option key={font.id} value={font.id}>
                    {font.label}
                  </option>
                ))}
              </select>
              <ToolbarButton
                label="Smaller text"
                onClick={() =>
                  updateSelected({ fontSize: Math.max(6, selected.fontSize - 1) })
                }
              >
                <Minus size={16} aria-hidden />
              </ToolbarButton>
              <span className="w-8 text-center font-body text-sm tabular-nums">
                {selected.fontSize}
              </span>
              <ToolbarButton
                label="Larger text"
                onClick={() => updateSelected({ fontSize: selected.fontSize + 1 })}
              >
                <Plus size={16} aria-hidden />
              </ToolbarButton>
              <div className="mx-1 h-6 w-px bg-outline-variant/50" aria-hidden />
              <ToolbarButton
                label="Bold"
                active={!!selected.bold}
                onClick={() => updateSelected({ bold: !selected.bold })}
              >
                <Bold size={16} aria-hidden />
              </ToolbarButton>
              <ToolbarButton
                label="Italic"
                active={!!selected.italic}
                onClick={() => updateSelected({ italic: !selected.italic })}
              >
                <Italic size={16} aria-hidden />
              </ToolbarButton>
              {(
                [
                  ["left", AlignLeft],
                  ["center", AlignCenter],
                  ["right", AlignRight],
                ] as const
              ).map(([align, Icon]) => (
                <ToolbarButton
                  key={align}
                  label={`Align ${align}`}
                  active={selected.align === align}
                  onClick={() => updateSelected({ align })}
                >
                  <Icon size={16} aria-hidden />
                </ToolbarButton>
              ))}
              <div className="mx-1 h-6 w-px bg-outline-variant/50" aria-hidden />
            </>
          )}

          {(selected.type === "text" ||
            selected.type === "shape" ||
            selected.type === "clipart" ||
            selected.type === "frame") && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {INK_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Colour ${color}`}
                    onClick={() => updateSelected({ color })}
                    className={`h-5 w-5 rounded-full border ${
                      selected.color === color
                        ? "border-primary ring-2 ring-primary-container/40"
                        : "border-outline-variant/60"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="h-5 w-px bg-outline-variant/50" aria-hidden />
              <ColorPicker
                value={selected.color}
                onChange={(color) => updateSelected({ color })}
              />
            </div>
          )}

          {selected.type === "image" && (
            <>
              <button
                type="button"
                onClick={() => openPhotoPicker(selected.id)}
                className="flex items-center gap-2 rounded-md px-2.5 py-1.5 font-body text-sm text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
              >
                <ImagePlus size={15} aria-hidden />
                {selected.src ? "Replace photo" : "Upload photo"}
              </button>
              {PHOTO_SHAPE_OPTIONS.map(({ id, label, Icon }) => (
                <ToolbarButton
                  key={id}
                  label={label}
                  active={imageShape(selected) === id}
                  onClick={() => updateSelected({ shape: id })}
                >
                  <Icon size={16} aria-hidden />
                </ToolbarButton>
              ))}
              <div className="mx-1 h-6 w-px bg-outline-variant/50" aria-hidden />
              <span className="font-body text-xs text-on-surface-variant">Border</span>
              <ToolbarButton
                label="No border"
                active={!selected.border}
                onClick={() => updateSelected({ border: undefined })}
              >
                <Ban size={16} aria-hidden />
              </ToolbarButton>
              {FRAME_VARIANTS.map((variant) => (
                <ToolbarButton
                  key={variant}
                  label={`${FRAME_VARIANT_LABELS[variant]} border`}
                  active={selected.border === variant}
                  onClick={() =>
                    updateSelected({
                      border: variant,
                      borderColor: selected.borderColor ?? DEFAULT_PHOTO_BORDER_COLOR,
                    })
                  }
                >
                  <FrameSwatch variant={variant} />
                </ToolbarButton>
              ))}
              {selected.border && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {INK_PALETTE.map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={`Border colour ${color}`}
                        onClick={() => updateSelected({ borderColor: color })}
                        className={`h-5 w-5 rounded-full border ${
                          (selected.borderColor ?? DEFAULT_PHOTO_BORDER_COLOR) === color
                            ? "border-primary ring-2 ring-primary-container/40"
                            : "border-outline-variant/60"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="h-5 w-px bg-outline-variant/50" aria-hidden />
                  <ColorPicker
                    value={selected.borderColor ?? DEFAULT_PHOTO_BORDER_COLOR}
                    onChange={(borderColor) => updateSelected({ borderColor })}
                  />
                </div>
              )}
            </>
          )}

          <div className="ml-auto flex items-center gap-1">
            {authoring && (
              <ToolbarButton
                label={selected.locked ? "Unlock element" : "Lock element"}
                active={!!selected.locked}
                onClick={() => updateSelected({ locked: !selected.locked })}
              >
                {selected.locked ? (
                  <Lock size={16} aria-hidden />
                ) : (
                  <LockOpen size={16} aria-hidden />
                )}
              </ToolbarButton>
            )}
            <ToolbarButton label="Delete element" onClick={deleteSelected}>
              <Trash2 size={16} aria-hidden />
            </ToolbarButton>
          </div>
        </div>
      )}

      {/* ------------------------------ body ---------------------------- */}
      <div className="relative flex min-h-0 flex-1">
        {/* icon rail (desktop) */}
        <nav
          aria-label="Editor panels"
          className="hidden w-[76px] shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-outline-variant/40 bg-surface-container-lowest py-3 md:flex"
        >
          {visibleTabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
              className={`flex w-16 flex-col items-center gap-1 rounded-lg px-1 py-2.5 font-body text-[11px] font-medium transition-colors ${
                tab === id
                  ? "bg-surface-container text-primary"
                  : "text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
              }`}
            >
              <Icon size={20} aria-hidden />
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setTipsOpen((open) => !open)}
            className="mt-auto flex w-16 flex-col items-center gap-1 rounded-lg px-1 py-2.5 font-body text-[11px] font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
          >
            <Lightbulb size={20} aria-hidden />
            Tips
          </button>
        </nav>

        {/* panel — sidebar on desktop, bottom sheet on mobile */}
        <aside
          className={`${
            mobilePanelOpen
              ? "absolute inset-x-0 bottom-0 z-30 flex max-h-[60dvh] rounded-t-2xl border-t shadow-[0_-8px_30px_rgba(31,26,30,0.18)]"
              : "hidden"
          } shrink-0 flex-col overflow-y-auto border-outline-variant/40 bg-surface p-4 md:static md:inset-auto md:z-auto md:flex md:max-h-none md:w-[300px] md:rounded-none md:border-r md:border-t-0 md:shadow-none`}
        >
          <div className="mb-3 flex items-center justify-between md:hidden">
            <span className="font-body text-sm font-medium capitalize text-on-surface">
              {visibleTabs.find((item) => item.id === tab)?.label}
            </span>
            <button
              type="button"
              aria-label="Close panel"
              onClick={() => setMobilePanelOpen(false)}
              className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container hover:text-primary"
            >
              <X size={16} aria-hidden />
            </button>
          </div>
          {tab === "product" && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="mb-3 font-display text-lg text-primary">
                  {productLabel} Printing
                </h2>
                <PanelHeading>Finished size</PanelHeading>
                <div className="rounded-xl border-2 border-secondary bg-surface-container-lowest p-4 text-center ambient-shadow">
                  <p className="font-display text-2xl text-primary">A5</p>
                  <p className="font-body text-xs text-on-surface-variant">
                    148 x 210mm portrait
                  </p>
                </div>
              </div>

              {authoring ? (
                <div>
                  <PanelHeading>Template structure</PanelHeading>
                  <ol className="flex flex-col gap-2">
                    {doc.pages.map((structurePage, index) => (
                      <li key={structurePage.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setPageIndex(index);
                            setSelectedId(null);
                          }}
                          aria-pressed={pageIndex === index}
                          className={`w-full rounded-lg border px-4 py-2.5 text-left transition-colors ${
                            pageIndex === index
                              ? "border-secondary bg-soft-sage"
                              : "border-outline-variant/60 bg-surface-container-lowest hover:bg-surface-container"
                          }`}
                        >
                          <span className="block font-body text-sm font-medium text-on-surface">
                            {templatePageLabel(index)}
                          </span>
                          <span className="block font-body text-xs text-on-surface-variant">
                            {index === 1
                              ? "Repeats to fill every inside page"
                              : index === 0
                                ? "Front of the booklet"
                                : "Back of the booklet"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : (
              <div>
                <PanelHeading>Number of pages</PanelHeading>
                <div className="flex flex-col gap-2">
                  {pricing.pages.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setPageCount(option.id)}
                      aria-pressed={pagesOptionId === option.id}
                      className={`rounded-full px-4 py-2.5 font-body text-sm font-medium tracking-wide transition-colors ${
                        pagesOptionId === option.id
                          ? "bg-primary-container text-white"
                          : "bg-surface-container-lowest text-on-surface-variant border border-outline-variant/60 hover:bg-surface-container"
                      }`}
                    >
                      {option.pages} pages (sides)
                    </button>
                  ))}
                </div>
              </div>
              )}

              {!authoring && (
              <div>
                <PanelHeading>Paper stock</PanelHeading>
                <div className="flex flex-col gap-2">
                  {pricing.paper.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setPaperId(option.id)}
                      aria-pressed={paperId === option.id}
                      className={`rounded-lg border px-4 py-2.5 text-left transition-colors ${
                        paperId === option.id
                          ? "border-secondary bg-soft-sage"
                          : "border-outline-variant/60 bg-surface-container-lowest hover:bg-surface-container"
                      }`}
                    >
                      <span className="block font-body text-sm font-medium text-on-surface">
                        {option.label}
                      </span>
                      {option.note && (
                        <span className="block font-body text-xs text-on-surface-variant">
                          {option.note}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              )}

              {!authoring && (
              <div className="rounded-xl border border-soft-sage bg-surface-container-lowest p-4 ambient-shadow">
                <p className="font-body text-sm text-on-surface-variant">
                  15 copies from{" "}
                  <span className="font-semibold text-secondary">
                    {formatPence(quote.totalPence)}
                  </span>{" "}
                  with free UK delivery.
                </p>
              </div>
              )}

              <p className="font-body text-xs leading-relaxed text-on-surface-variant">
                {authoring
                  ? "Customers choose 4, 8, 12, 16, 20 or 24 pages. The cover and back stay where they are and the middle page repeats to fill everything in between."
                  : "Our funeral order of service booklets are available as 4, 8, 12, 16, 20 and 24 page printed booklets, with premium card covers, full-colour printing and free UK delivery."}
              </p>
            </div>
          )}

          {tab === "templates" && (
            <div>
              <PanelHeading>Start from a template</PanelHeading>
              <p className="mb-3 font-body text-xs text-on-surface-variant">
                Templates with a full page design replace your whole document
                (we&apos;ll ask first); the rest refresh just your front cover.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {templates.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void applyTemplate(item)}
                    aria-current={item.id === activeTemplate.id}
                    className={`overflow-hidden rounded-lg border text-left transition-colors ${
                      item.id === activeTemplate.id
                        ? "border-secondary"
                        : "border-outline-variant/40 hover:border-primary-container"
                    }`}
                  >
                    <span className="relative block aspect-3/4 bg-surface-container-low">
                      <Image
                        src={item.image}
                        alt={`${item.name} template`}
                        fill
                        sizes="140px"
                        className="object-contain p-1.5"
                      />
                    </span>
                    <span className="block truncate px-2 py-1.5 font-body text-xs font-medium text-on-surface">
                      {item.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "text" && (
            <div className="flex flex-col gap-3">
              <PanelHeading>Add text</PanelHeading>
              <button
                type="button"
                onClick={() => addText("heading")}
                className="rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-4 py-3 text-left font-display text-2xl text-on-surface transition-colors hover:bg-surface-container"
              >
                Add a heading
              </button>
              <button
                type="button"
                onClick={() => addText("subheading")}
                className="rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-4 py-3 text-left font-display text-lg text-on-surface transition-colors hover:bg-surface-container"
              >
                Add a subheading
              </button>
              <button
                type="button"
                onClick={() => addText("body")}
                className="rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-4 py-3 text-left font-body text-sm text-on-surface transition-colors hover:bg-surface-container"
              >
                Add a little body text
              </button>
              <button
                type="button"
                onClick={() => addText("script")}
                className="rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-4 py-3 text-left text-3xl text-on-surface transition-colors hover:bg-surface-container"
                style={{ fontFamily: "var(--font-script), cursive" }}
              >
                With love
              </button>
              <p className="font-body text-xs text-on-surface-variant">
                Double-click any text on the page to edit the wording.
              </p>
            </div>
          )}

          {tab === "cliparts" && (
            <div>
              <PanelHeading>Cliparts</PanelHeading>
              <div className="grid grid-cols-3 gap-2">
                {CLIPARTS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    aria-label={`Add ${label} clipart`}
                    onClick={() =>
                      addElement({
                        id: uid("clipart"),
                        type: "clipart",
                        icon: id,
                        color: templateAccent(activeTemplate),
                        x: 42,
                        y: 42,
                        w: 16,
                        h: 11.3,
                      })
                    }
                    className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-outline-variant/50 bg-surface-container-lowest text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
                  >
                    <Icon size={26} strokeWidth={1.5} aria-hidden />
                    <span className="font-body text-[10px]">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "photos" && (
            <div className="flex flex-col gap-4">
              <PanelHeading>Photos</PanelHeading>
              <button
                type="button"
                onClick={() => openPhotoPicker()}
                className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-outline-variant px-4 py-6 font-body text-sm font-medium text-on-surface-variant transition-colors hover:border-primary-container hover:text-primary"
              >
                <ImagePlus size={18} aria-hidden />
                Upload a photo
              </button>
              {authoring && (
                <button
                  type="button"
                  onClick={addPhotoPlaceholder}
                  className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-outline-variant px-4 py-6 font-body text-sm font-medium text-on-surface-variant transition-colors hover:border-primary-container hover:text-primary"
                >
                  <ImageIcon size={18} aria-hidden />
                  Add a placeholder
                </button>
              )}
              {uploads.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {uploads.map((src, index) => (
                    <button
                      key={index}
                      type="button"
                      aria-label="Add this photo to the page"
                      onClick={() =>
                        addElement({
                          id: uid("image"),
                          type: "image",
                          src,
                          x: 30,
                          y: 30,
                          w: 40,
                          h: 28,
                        })
                      }
                      className="relative aspect-square overflow-hidden rounded-lg border border-outline-variant/40"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
              <p className="font-body text-xs text-on-surface-variant">
                Photos stay on this device until you place your order.
              </p>
            </div>
          )}

          {tab === "elements" && (
            <div className="flex flex-col gap-6">
              <div>
                <PanelHeading>Page background</PanelHeading>
                <div className="flex items-center gap-2">
                  {PAGE_BACKGROUND_PALETTE.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Page background ${color}`}
                      onClick={() => setPageBackground(color === "#ffffff" ? undefined : color)}
                      className={`h-7 w-7 rounded-full border ${
                        (page.background ?? "#ffffff") === color
                          ? "border-primary ring-2 ring-primary-container/40"
                          : "border-outline-variant/60"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <PanelHeading>Shapes</PanelHeading>
                <div className="grid grid-cols-3 gap-2">
                  <ElementSwatch
                    label="Line"
                    onClick={() =>
                      addElement({
                        id: uid("shape"),
                        type: "shape",
                        shape: "line",
                        color: "#1f1a1e",
                        strokeWidth: 1.5,
                        x: 30,
                        y: 50,
                        w: 40,
                        h: 1,
                      })
                    }
                  >
                    <Minus size={26} strokeWidth={1.5} aria-hidden />
                  </ElementSwatch>
                  <ElementSwatch
                    label="Rectangle"
                    onClick={() =>
                      addElement({
                        id: uid("shape"),
                        type: "shape",
                        shape: "rect",
                        color: "#1f1a1e",
                        strokeWidth: 1.5,
                        x: 32,
                        y: 40,
                        w: 36,
                        h: 18,
                      })
                    }
                  >
                    <Square size={26} strokeWidth={1.5} aria-hidden />
                  </ElementSwatch>
                  <ElementSwatch
                    label="Circle"
                    onClick={() =>
                      addElement({
                        id: uid("shape"),
                        type: "shape",
                        shape: "circle",
                        color: "#1f1a1e",
                        strokeWidth: 1.5,
                        x: 37,
                        y: 40,
                        w: 26,
                        h: 18.3,
                      })
                    }
                  >
                    <Circle size={26} strokeWidth={1.5} aria-hidden />
                  </ElementSwatch>
                  <ElementSwatch
                    label="Flourish divider"
                    onClick={() =>
                      addElement({
                        id: uid("image"),
                        type: "image",
                        src: "/elements/divider-flourish.png",
                        x: 30,
                        y: 49.5,
                        w: 40,
                        h: 3.06,
                      })
                    }
                  >
                    <img
                      src="/elements/divider-flourish.png"
                      alt=""
                      aria-hidden
                      className="w-full opacity-80"
                    />
                  </ElementSwatch>
                  <ElementSwatch
                    label="Floral divider"
                    onClick={() =>
                      addElement({
                        id: uid("image"),
                        type: "image",
                        src: "/elements/divider-floral-spray.png",
                        x: 30,
                        y: 49.5,
                        w: 40,
                        h: 5.3,
                      })
                    }
                  >
                    <img
                      src="/elements/divider-floral-spray.png"
                      alt=""
                      aria-hidden
                      className="w-full opacity-80"
                    />
                  </ElementSwatch>
                  <ElementSwatch
                    label="Dot divider"
                    onClick={() =>
                      addElement({
                        id: uid("image"),
                        type: "image",
                        src: "/elements/divider-dot.png",
                        x: 30,
                        y: 49.5,
                        w: 40,
                        h: 2.27,
                      })
                    }
                  >
                    <img
                      src="/elements/divider-dot.png"
                      alt=""
                      aria-hidden
                      className="w-full opacity-80"
                    />
                  </ElementSwatch>
                  <ElementSwatch
                    label="Heart divider"
                    onClick={() =>
                      addElement({
                        id: uid("image"),
                        type: "image",
                        src: "/elements/divider-heart.png",
                        x: 30,
                        y: 49.5,
                        w: 40,
                        h: 4.95,
                      })
                    }
                  >
                    <img
                      src="/elements/divider-heart.png"
                      alt=""
                      aria-hidden
                      className="w-full opacity-80"
                    />
                  </ElementSwatch>
                  <ElementSwatch
                    label="Sprig"
                    onClick={() =>
                      addElement({
                        id: uid("image"),
                        type: "image",
                        src: "/elements/floral-sprig.png",
                        x: 43,
                        y: 40,
                        w: 14,
                        h: 19,
                      })
                    }
                  >
                    <img
                      src="/elements/floral-sprig.png"
                      alt=""
                      aria-hidden
                      className="h-8 w-auto opacity-80"
                    />
                  </ElementSwatch>
                  <ElementSwatch
                    label="Peony"
                    onClick={() =>
                      addElement({
                        id: uid("image"),
                        type: "image",
                        src: "/elements/floral-peony.png",
                        x: 33,
                        y: 40,
                        w: 34,
                        h: 17.93,
                      })
                    }
                  >
                    <img
                      src="/elements/floral-peony.png"
                      alt=""
                      aria-hidden
                      className="h-8 w-auto opacity-80"
                    />
                  </ElementSwatch>
                  <ElementSwatch
                    label="Gold dot divider"
                    onClick={() =>
                      addElement({
                        id: uid("image"),
                        type: "image",
                        src: "/elements/divider-dot-gold.png",
                        x: 30,
                        y: 49.5,
                        w: 40,
                        h: 2.35,
                      })
                    }
                  >
                    <img
                      src="/elements/divider-dot-gold.png"
                      alt=""
                      aria-hidden
                      className="w-full opacity-80"
                    />
                  </ElementSwatch>
                  <ElementSwatch
                    label="Gold scroll divider"
                    onClick={() =>
                      addElement({
                        id: uid("image"),
                        type: "image",
                        src: "/elements/divider-scroll-floral.png",
                        x: 30,
                        y: 49.5,
                        w: 40,
                        h: 8.46,
                      })
                    }
                  >
                    <img
                      src="/elements/divider-scroll-floral.png"
                      alt=""
                      aria-hidden
                      className="w-full opacity-80"
                    />
                  </ElementSwatch>
                  <ElementSwatch
                    label="Gold swirl divider"
                    onClick={() =>
                      addElement({
                        id: uid("image"),
                        type: "image",
                        src: "/elements/divider-swirl.png",
                        x: 30,
                        y: 49.5,
                        w: 40,
                        h: 5.69,
                      })
                    }
                  >
                    <img
                      src="/elements/divider-swirl.png"
                      alt=""
                      aria-hidden
                      className="w-full opacity-80"
                    />
                  </ElementSwatch>
                  <ElementSwatch
                    label="Gold bar accent"
                    onClick={() =>
                      addElement({
                        id: uid("image"),
                        type: "image",
                        src: "/elements/divider-bar-accent.png",
                        x: 38,
                        y: 49.5,
                        w: 24,
                        h: 5.14,
                      })
                    }
                  >
                    <img
                      src="/elements/divider-bar-accent.png"
                      alt=""
                      aria-hidden
                      className="w-full opacity-80"
                    />
                  </ElementSwatch>
                  <ElementSwatch
                    label="Gold vertical bar"
                    onClick={() =>
                      addElement({
                        id: uid("image"),
                        type: "image",
                        src: "/elements/divider-bar-vertical.png",
                        x: 41.9,
                        y: 34,
                        w: 16.2,
                        h: 32,
                      })
                    }
                  >
                    <img
                      src="/elements/divider-bar-vertical.png"
                      alt=""
                      aria-hidden
                      className="h-8 w-auto opacity-80"
                    />
                  </ElementSwatch>
                </div>
              </div>

              <div>
                <PanelHeading>Page borders</PanelHeading>
                <div className="grid grid-cols-3 gap-2">
                  {FRAME_VARIANTS.map((variant) => (
                    <ElementSwatch
                      key={variant}
                      label={variant}
                      onClick={() =>
                        addElement({
                          id: uid("frame"),
                          type: "frame",
                          variant,
                          color: "#1f1a1e",
                          x: 4,
                          y: 3,
                          w: 92,
                          h: 94,
                        })
                      }
                    >
                      <FrameSwatch variant={variant} className="h-8 w-6" />
                    </ElementSwatch>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "layers" && (
            <div>
              <PanelHeading>
                {authoring
                  ? `Layers — ${templatePageLabel(pageIndex).toLowerCase()}`
                  : `Layers — page ${pageIndex + 1}`}
              </PanelHeading>
              {page.elements.length === 0 ? (
                <p className="font-body text-sm text-on-surface-variant">
                  Nothing on this page yet. Add text, photos or elements from
                  the panels on the left.
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {[...page.elements]
                    .map((element, index) => ({ element, index }))
                    .reverse()
                    .map(({ element, index }) => {
                      const inert = !!element.locked && !authoring;
                      return (
                      <li
                        key={element.id}
                        className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${
                          element.id === selectedId
                            ? "border-primary-container bg-surface-container"
                            : "border-outline-variant/40 bg-surface-container-lowest"
                        } ${inert ? "opacity-70" : ""}`}
                      >
                        <button
                          type="button"
                          disabled={inert}
                          onClick={() => setSelectedId(element.id)}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-default"
                        >
                          <LayerIcon element={element} />
                          <span className="truncate font-body text-xs text-on-surface">
                            {layerLabel(element)}
                          </span>
                          {element.locked && (
                            <Lock
                              size={12}
                              aria-label="Locked"
                              className="shrink-0 text-on-surface-variant"
                            />
                          )}
                        </button>
                        {inert ? null : (
                        <>
                        <button
                          type="button"
                          aria-label="Bring forward"
                          onClick={() => reorderSelectedWith(index, index + 1)}
                          className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high"
                        >
                          <ChevronUp size={14} aria-hidden />
                        </button>
                        <button
                          type="button"
                          aria-label="Send backward"
                          onClick={() => reorderSelectedWith(index, index - 1)}
                          className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high"
                        >
                          <ChevronDown size={14} aria-hidden />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete layer"
                          onClick={() => {
                            commit(
                              withElements(
                                doc,
                                pageIndex,
                                page.elements.filter((e) => e.id !== element.id),
                              ),
                            );
                            if (selectedId === element.id) setSelectedId(null);
                          }}
                          className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
                        >
                          <Trash2 size={14} aria-hidden />
                        </button>
                        </>
                        )}
                      </li>
                      );
                    })}
                </ul>
              )}
            </div>
          )}
        </aside>

        {/* canvas */}
        <div
          ref={canvasAreaRef}
          className="relative flex min-w-0 flex-1 flex-col overflow-hidden"
        >
          <div
            className="flex flex-1 items-start justify-center overflow-auto p-4 md:p-8"
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedId(null);
                setEditingId(null);
              }
            }}
          >
            <PageCanvas
              page={page}
              zoom={zoom}
              showCut={showCut}
              showSafe={showSafe}
              guides={guides}
              selectedId={selectedId}
              editingId={editingId}
              editLocked={authoring}
              onSelect={setSelectedId}
              onStartDrag={startDrag}
              onStartEdit={(element) => {
                if (element.type === "text") {
                  snapshot();
                  setEditingId(element.id);
                } else if (element.type === "image") {
                  openPhotoPicker(element.id);
                }
              }}
              onEditText={(id, text) =>
                setDoc((current) =>
                  patchElement(current, pageIndex, id, (el) =>
                    el.type === "text" ? { ...el, text } : el,
                  ),
                )
              }
              onEndEdit={() => setEditingId(null)}
              onBackgroundClick={() => {
                setSelectedId(null);
                setEditingId(null);
              }}
            />
          </div>

          {/* tips card */}
          {tipsOpen && (
            <div className="absolute right-4 top-4 hidden max-w-xs items-start gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 ambient-shadow md:flex">
              <Lightbulb size={20} className="mt-0.5 shrink-0 text-secondary" aria-hidden />
              <div className="font-body text-xs leading-relaxed text-on-surface-variant">
                <p>— Double-click text to edit the wording</p>
                <p>— Drag to move, corner handles to resize</p>
                <p>— Double-click a photo frame to upload</p>
              </div>
              <button
                type="button"
                aria-label="Dismiss tips"
                onClick={() => setTipsOpen(false)}
                className="rounded p-0.5 text-on-surface-variant hover:text-primary"
              >
                <X size={14} aria-hidden />
              </button>
            </div>
          )}

          {/* page navigation */}
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 flex-col items-center gap-2 md:right-4">
            <button
              type="button"
              aria-label="Previous page"
              disabled={pageIndex === 0}
              onClick={() => {
                setPageIndex((index) => Math.max(0, index - 1));
                setSelectedId(null);
              }}
              className="rounded-full border border-outline-variant/50 bg-surface-container-lowest p-2 text-on-surface-variant transition-colors hover:text-primary disabled:opacity-30"
            >
              <ArrowUp size={16} aria-hidden />
            </button>
            <span className="font-body text-sm text-on-surface-variant tabular-nums">
              {authoring ? templatePageLabel(pageIndex) : `${pageIndex + 1}/${doc.pages.length}`}
            </span>
            <button
              type="button"
              aria-label="Next page"
              disabled={pageIndex >= doc.pages.length - 1}
              onClick={() => {
                setPageIndex((index) => Math.min(doc.pages.length - 1, index + 1));
                setSelectedId(null);
              }}
              className="rounded-full border border-outline-variant/50 bg-surface-container-lowest p-2 text-on-surface-variant transition-colors hover:text-primary disabled:opacity-30"
            >
              <ArrowDown size={16} aria-hidden />
            </button>
          </div>

          {/* guide toggles */}
          <div className="absolute left-4 top-4 flex items-center gap-2 md:bottom-4 md:left-1/2 md:top-auto md:-translate-x-1/2">
            <GuideChip
              label="Cut line"
              color="#c2410c"
              active={showCut}
              onClick={() => setShowCut((v) => !v)}
            />
            <GuideChip
              label="Safe zone"
              color="#226b3d"
              active={showSafe}
              onClick={() => setShowSafe((v) => !v)}
            />
          </div>

          {/* zoom */}
          <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-1.5 py-1 ambient-shadow">
            <ToolbarButton label="Fit page" onClick={fitZoom}>
              <Maximize2 size={15} aria-hidden />
            </ToolbarButton>
            <ToolbarButton
              label="Zoom out"
              onClick={() => setZoom((z) => clamp(z - 0.1, 0.3, 2))}
            >
              <Minus size={15} aria-hidden />
            </ToolbarButton>
            <span className="w-12 text-center font-body text-sm tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <ToolbarButton
              label="Zoom in"
              onClick={() => setZoom((z) => clamp(z + 0.1, 0.3, 2))}
            >
              <Plus size={15} aria-hidden />
            </ToolbarButton>
          </div>
        </div>
      </div>

      {/* bottom tab bar (mobile) */}
      <nav
        aria-label="Editor panels"
        className="flex shrink-0 items-stretch gap-1 overflow-x-auto border-t border-outline-variant/40 bg-surface-container-lowest px-2 py-1.5 md:hidden"
      >
        {visibleTabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              if (mobilePanelOpen && tab === id) {
                setMobilePanelOpen(false);
              } else {
                setTab(id);
                setMobilePanelOpen(true);
              }
            }}
            aria-pressed={tab === id && mobilePanelOpen}
            className={`flex min-w-[60px] flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 font-body text-[10px] font-medium transition-colors ${
              tab === id && mobilePanelOpen
                ? "bg-surface-container text-primary"
                : "text-on-surface-variant"
            }`}
          >
            <Icon size={18} aria-hidden />
            {label}
          </button>
        ))}
      </nav>

      {/* toast */}
      {toast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-inverse-surface px-5 py-2.5 font-body text-sm text-inverse-on-surface">
          {toast}
        </div>
      )}

      {/* pre-order check — the last look before a design becomes an order */}
      {preOrderCheck && (
        <PreOrderCheckDialog
          check={preOrderCheck}
          busy={addingToCart}
          onConfirm={() => void addToCart(true)}
          onClose={() => setPreOrderCheck(null)}
        />
      )}

      {/* preview modal */}
      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Design preview"
          className="fixed inset-0 z-50 flex flex-col bg-on-surface/70 p-6"
          onClick={() => setPreview(false)}
        >
          <div
            className={`mx-auto flex max-h-full w-full flex-col rounded-xl bg-surface p-6 ${
              previewMode === "booklet" ? "h-full max-w-6xl" : "max-w-5xl"
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="font-display text-xl text-primary">Preview</h2>
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
                ).map(({ mode, label, Icon }) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={previewMode === mode}
                    onClick={() => setPreviewMode(mode)}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-body text-sm transition-colors ${
                      previewMode === mode
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
                onClick={() => setPreview(false)}
                className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container hover:text-primary"
              >
                <X size={18} aria-hidden />
              </button>
            </div>
            {previewMode === "booklet" ? (
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden pb-2">
                {/* A template is only ever cover / middle / back, so show it
                    the way a customer would actually get it: expanded to a
                    real booklet, middle page repeated. */}
                {authoring && (
                  <p className="text-center font-body text-xs text-on-surface-variant">
                    Shown as an 8-page booklet, middle page repeated.
                  </p>
                )}
                <BookletPreview
                  pages={authoring ? withPageCount(doc, 8).pages : doc.pages}
                  renderPage={(page, scale) => <StaticPage page={page} scale={scale} plain />}
                />
              </div>
            ) : (
              <div className="flex flex-wrap justify-center gap-6 overflow-auto pb-2">
                {doc.pages.map((previewPage, index) => (
                  <div key={previewPage.id} className="flex flex-col items-center gap-2">
                    <StaticPage page={previewPage} scale={0.45} />
                    <span className="font-body text-xs text-on-surface-variant">
                      {authoring ? templatePageLabel(index) : `Page ${index + 1}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex flex-wrap justify-end gap-3">
              {/* Admin-only. Customers review their proof on the order page
                  after payment — the print-ready PDF is a press artefact,
                  never something the customer downloads. */}
              {authoring && (
                <button
                  type="button"
                  onClick={downloadProof}
                  disabled={proofState === "generating"}
                  className="flex items-center gap-2 rounded-lg border-2 border-primary-container px-5 py-3 font-body text-sm font-medium text-primary-container transition-colors hover:bg-surface-container disabled:opacity-60"
                >
                  <FileDown size={16} aria-hidden />
                  {proofState === "generating" ? "Generating proof…" : "Download proof PDF"}
                </button>
              )}
              {!authoring && (
                <button
                  type="button"
                  onClick={() => void addToCart()}
                  disabled={addingToCart}
                  className="flex items-center gap-2 rounded-lg bg-primary-container px-5 py-3 font-body text-sm font-medium text-white transition-colors hover:bg-primary disabled:opacity-60"
                >
                  <ShoppingCart size={16} aria-hidden />
                  {addingToCart ? "Adding…" : "Add to basket"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Canvas                                                              */
/* ------------------------------------------------------------------ */

/**
 * Renders one page's elements plus the print guides. Exported so
 * /proof-render can screenshot the exact same markup the live editor draws
 * — no separate PDF-layout implementation to keep in sync.
 */
export function PageCanvas({
  page,
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
  return (
    <div
      style={{ width: ARTBOARD_W * zoom, height: ARTBOARD_H * zoom }}
      className="relative shrink-0"
    >
      <div
        style={{
          width: ARTBOARD_W,
          height: ARTBOARD_H,
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
          style={{ left: BLEED_PX, top: BLEED_PX, width: PAGE_W, height: PAGE_H }}
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
              width: PAGE_W,
              height: PAGE_H,
              borderColor: "#c2410c",
            }}
          />
        )}
      </div>
    </div>
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
  const border = element.border;
  const inset = border ? frameDepth(border) : 0;
  const innerRadius = border ? photoInnerBorderRadius(element, inset) : undefined;
  return (
    <div
      className={`relative h-full w-full overflow-hidden ${
        element.src || border ? "" : "border-2 border-dashed border-[#d3c2cd]"
      } ${element.src ? "" : "bg-[#faf6f8]"}`}
      style={{ borderRadius: photoBorderRadius(element), padding: inset }}
    >
      <div
        className="h-full w-full overflow-hidden"
        style={{ borderRadius: innerRadius ?? photoBorderRadius(element) }}
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
            radiusAt={(offset) => photoInnerBorderRadius(element, offset)}
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

function StaticPage({
  page,
  scale,
  plain = false,
}: {
  page: DesignPage;
  scale: number;
  /** No shadow or rounding — for when the page sits inside something that
      already has depth of its own, like a booklet leaf. */
  plain?: boolean;
}) {
  return (
    <div
      style={{ width: PAGE_W * scale, height: PAGE_H * scale }}
      className={`relative shrink-0 overflow-hidden ${
        plain ? "" : "rounded-sm shadow-[0_4px_20px_rgba(31,26,30,0.15)]"
      }`}
    >
      <div
        style={{
          width: PAGE_W,
          height: PAGE_H,
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
  );
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function ArchIcon({ size = 16 }: { size?: number | string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 21v-9a7 7 0 0 1 14 0v9z" />
    </svg>
  );
}

const FRAME_VARIANT_LABELS: Record<FrameVariant, string> = {
  single: "Single",
  double: "Double",
  triple: "Triple",
};

/** A tiny rectangle previewing a frame variant's line pattern. */
function FrameSwatch({
  variant,
  className = "h-4 w-3",
}: {
  variant: FrameVariant;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`block border border-current ${className}`}
      style={
        variant === "single"
          ? undefined
          : {
              boxShadow:
                variant === "double"
                  ? "inset 0 0 0 2.5px #fff, inset 0 0 0 3.5px currentcolor"
                  : "inset 0 0 0 2px #fff, inset 0 0 0 3px currentcolor, inset 0 0 0 5px #fff, inset 0 0 0 6px currentcolor",
            }
      }
    />
  );
}

const PHOTO_SHAPE_OPTIONS: {
  id: PhotoShape;
  label: string;
  Icon: ComponentType<{ size?: number | string; "aria-hidden"?: boolean }>;
}[] = [
  { id: "rect", label: "Rectangular photo", Icon: Square },
  { id: "oval", label: "Oval photo", Icon: Circle },
  { id: "arch", label: "Arch photo", Icon: ArchIcon },
];

function ToolbarButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg p-2 transition-colors disabled:opacity-30 ${
        active
          ? "bg-surface-container text-primary"
          : "text-on-surface-variant hover:bg-surface-container hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}

/** 3- or 6-digit hex (with or without `#`) → lowercase `#rrggbb`, or null if invalid. */
function normalizeHex(raw: string): string | null {
  const withHash = raw.trim().startsWith("#") ? raw.trim() : `#${raw.trim()}`;
  if (/^#[0-9a-f]{6}$/i.test(withHash)) return withHash.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(withHash)) {
    const [r, g, b] = withHash.slice(1).split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const [prevValue, setPrevValue] = useState(value);
  const [text, setText] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setText(value);
  }

  const commit = (raw: string) => {
    const normalized = normalizeHex(raw);
    if (normalized) onChange(normalized);
    else setText(value);
  };

  const swatchColor = normalizeHex(value) ?? "#000000";

  return (
    <div className="flex items-center gap-1.5">
      <label
        className="relative flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border border-outline-variant/60"
        style={{
          background:
            "conic-gradient(from 180deg, #ef4444, #f59e0b, #22c55e, #06b6d4, #3b82f6, #a855f7, #ef4444)",
        }}
        title="Custom colour"
      >
        <input
          type="color"
          value={swatchColor}
          onChange={(event) => onChange(event.target.value)}
          aria-label="Pick a custom colour"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <Pipette size={11} aria-hidden className="pointer-events-none text-white drop-shadow" />
      </label>
      <input
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          commit(event.currentTarget.value);
          event.currentTarget.blur();
        }}
        aria-label="Hex colour value"
        placeholder="#000000"
        spellCheck={false}
        className="w-[4.5rem] rounded-md border border-outline-variant/50 bg-transparent px-1.5 py-1 font-mono text-xs text-on-surface-variant focus:border-primary focus:outline-none"
      />
    </div>
  );
}

function GuideChip({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-2 rounded-full border border-outline-variant/50 bg-surface-container-lowest px-4 py-1.5 font-body text-sm transition-opacity ${
        active ? "text-on-surface" : "text-on-surface-variant opacity-60"
      }`}
    >
      {label}
      <span
        aria-hidden
        className="h-3.5 w-3.5 rounded-full border-2"
        style={{
          borderColor: color,
          backgroundColor: active ? color : "transparent",
        }}
      />
    </button>
  );
}

function PanelHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary">
      {children}
    </h3>
  );
}

function ElementSwatch({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={`Add ${label}`}
      onClick={onClick}
      className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-outline-variant/50 bg-surface-container-lowest text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
    >
      {children}
      <span className="font-body text-[10px] capitalize">{label}</span>
    </button>
  );
}

function LayerIcon({ element }: { element: CanvasElement }) {
  const size = 14;
  switch (element.type) {
    case "text":
      return <Type size={size} aria-hidden className="shrink-0 text-on-surface-variant" />;
    case "image":
      return <ImageIcon size={size} aria-hidden className="shrink-0 text-on-surface-variant" />;
    case "shape":
      return <Shapes size={size} aria-hidden className="shrink-0 text-on-surface-variant" />;
    case "clipart":
      return <Star size={size} aria-hidden className="shrink-0 text-on-surface-variant" />;
    default:
      return <Square size={size} aria-hidden className="shrink-0 text-on-surface-variant" />;
  }
}

function layerLabel(element: CanvasElement): string {
  switch (element.type) {
    case "text":
      return element.text.split("\n")[0] || "Text";
    case "image":
      return element.src ? "Photo" : "Photo placeholder";
    case "shape":
      return element.shape === "line"
        ? "Line"
        : element.shape === "circle"
          ? "Circle"
          : "Rectangle";
    case "clipart":
      return `Clipart — ${element.icon}`;
    default:
      return "Page border";
  }
}
