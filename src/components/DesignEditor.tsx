"use client";

import Image from "next/image";
import Link from "next/link";
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
  Bold,
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
  LayoutTemplate,
  Leaf,
  Lightbulb,
  Maximize2,
  Minus,
  Music,
  Package,
  Plus,
  Redo2,
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
  X,
} from "lucide-react";

import {
  ARTBOARD_H,
  ARTBOARD_W,
  BLEED_PX,
  FONT_OPTIONS,
  INK_PALETTE,
  PAGE_H,
  PAGE_W,
  makeStarterDoc,
  templateAccent,
  uid,
  withPageCount,
  type CanvasElement,
  type ClipartElement,
  type DesignDoc,
  type DesignPage,
  type FontFamilyId,
  type FrameElement,
  type ImageElement,
  type ProofRequest,
  type ShapeElement,
  type TextElement,
} from "@/lib/designEditor";
import {
  PAGE_OPTIONS,
  PAPER_OPTIONS,
  formatPrice,
  getQuote,
} from "@/lib/orderOfServicePricing";
import { TEMPLATES, type Template } from "@/lib/templates";

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
  savedDesign,
}: {
  template: Template;
  productId: string;
  productLabel: string;
  /** An existing design loaded server-side from ?design=<id>, if any. */
  savedDesign?: {
    id: string;
    name: string;
    doc: DesignDoc;
    pagesOptionId: string;
    paperId: string;
  };
}) {
  const [doc, setDoc] = useState<DesignDoc>(
    () => savedDesign?.doc ?? makeStarterDoc(template, 4),
  );
  const [history, setHistory] = useState<DesignDoc[]>([]);
  const [future, setFuture] = useState<DesignDoc[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("product");
  const [zoom, setZoom] = useState(0.85);
  const [showCut, setShowCut] = useState(true);
  const [showSafe, setShowSafe] = useState(true);
  const [pagesOptionId, setPagesOptionId] = useState(savedDesign?.pagesOptionId ?? "4");
  const [paperId, setPaperId] = useState(savedDesign?.paperId ?? "silk");
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
  const [toast, setToast] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(true);
  const [proofState, setProofState] = useState<"idle" | "generating">("idle");
  /** Whether the active panel is open as a bottom sheet (mobile only). */
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  const clipboardRef = useRef<CanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<string | null>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  const page = doc.pages[Math.min(pageIndex, doc.pages.length - 1)];
  const selected =
    page?.elements.find((element) => element.id === selectedId) ?? null;

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
    async (options: { silent?: boolean } = {}) => {
      setSaveState("saving");
      try {
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
      } catch {
        setSaveState("error");
        if (!options.silent) flash("Could not save — please try again");
      }
    },
    [doc, pagesOptionId, paperId, designName, designId, activeTemplate.id, productId, flash],
  );

  const saveDesign = () => {
    void persist();
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
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      void persist({ silent: true });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [doc, pagesOptionId, paperId, persist]);

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
    mode: "move" | "resize",
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

    const onMove = (move: PointerEvent) => {
      if (!moved) {
        if (Math.hypot(move.clientX - startX, move.clientY - startY) < 3) return;
        moved = true;
        snapshot();
      }
      const dx = ((move.clientX - startX) / (PAGE_W * dragZoom)) * 100;
      const dy = ((move.clientY - startY) / (PAGE_H * dragZoom)) * 100;
      setDoc((current) =>
        patchElement(current, activePage, element.id, (el) => {
          if (mode === "move") {
            return {
              ...el,
              x: clamp(origin.x + dx, -30, 96),
              y: clamp(origin.y + dy, -20, 97),
            };
          }
          const w = Math.max(4, origin.w + dx);
          if (el.type === "text" && origin.type === "text") {
            const fontSize = Math.max(
              6,
              Math.round(origin.fontSize * (w / origin.w)),
            );
            return { ...el, w, fontSize };
          }
          return { ...el, w, h: Math.max(1, origin.h + dy) };
        }),
      );
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
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

  const applyTemplate = (next: Template) => {
    const starter = makeStarterDoc(next, doc.pages.length);
    // templateId has to move with the cover: it's what gets persisted to
    // designs.template_id, so leaving it behind would save the design under
    // whichever template happened to be open first.
    commit({
      ...withElements(doc, 0, starter.pages[0].elements),
      templateId: next.id,
    });
    setActiveTemplate(next);
    // Follow the template name only while it's still the auto-derived one —
    // a name the user set themselves on /designs is left alone.
    setDesignName((current) => (current === activeTemplate.name ? next.name : current));
    setPageIndex(0);
    setSelectedId(null);
    flash(`Applied “${next.name}” to your cover`);
  };

  const setPageCount = (optionId: string) => {
    const option = PAGE_OPTIONS.find((o) => o.id === optionId);
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
      getQuote({
        quantity: "15",
        size: "a5",
        colour: "full-colour-both",
        pages: pagesOptionId,
        paper: paperId,
        delivery: "standard",
      }),
    [pagesOptionId, paperId],
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
          href="/templates"
          className="flex items-center gap-2 rounded-lg border border-outline-variant/60 px-2.5 py-2 font-body text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary sm:px-3"
        >
          <Home size={16} aria-hidden />
          <span className="hidden sm:inline">Home</span>
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

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <span
            aria-live="polite"
            className="hidden font-body text-xs text-on-surface-variant lg:inline"
          >
            {saveState === "saving"
              ? "Saving…"
              : saveState === "saved"
                ? "All changes saved"
                : saveState === "error"
                  ? "Not saved"
                  : ""}
          </span>
          <button
            type="button"
            onClick={saveDesign}
            disabled={saveState === "saving"}
            className="flex items-center gap-2 rounded-lg bg-secondary p-2.5 font-body text-sm font-medium text-on-secondary transition-colors hover:bg-on-secondary-container disabled:opacity-60 sm:px-4"
          >
            <Save size={16} aria-hidden />
            <span className="hidden md:inline">Save Design</span>
          </button>
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
          <Link
            href="/order-of-service"
            className="flex items-center gap-2 rounded-lg bg-primary-container p-2.5 font-body text-sm font-medium text-white transition-colors hover:bg-primary sm:px-4"
          >
            <ShoppingCart size={16} aria-hidden className="md:hidden" />
            <span className="hidden md:inline">Add To Cart</span>
            <ArrowRight size={16} aria-hidden className="hidden md:block" />
          </Link>
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
              <ToolbarButton
                label="Round photo"
                active={!!selected.round}
                onClick={() => updateSelected({ round: !selected.round })}
              >
                <Circle size={16} aria-hidden />
              </ToolbarButton>
            </>
          )}

          <div className="ml-auto">
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
          {TABS.map(({ id, label, Icon }) => (
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
              {TABS.find((item) => item.id === tab)?.label}
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

              <div>
                <PanelHeading>Number of pages</PanelHeading>
                <div className="flex flex-col gap-2">
                  {PAGE_OPTIONS.map((option) => (
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

              <div>
                <PanelHeading>Paper stock</PanelHeading>
                <div className="flex flex-col gap-2">
                  {PAPER_OPTIONS.map((option) => (
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

              <div className="rounded-xl border border-soft-sage bg-surface-container-lowest p-4 ambient-shadow">
                <p className="font-body text-sm text-on-surface-variant">
                  15 copies from{" "}
                  <span className="font-semibold text-secondary">
                    {formatPrice(quote.total)}
                  </span>{" "}
                  with free UK delivery.
                </p>
              </div>

              <p className="font-body text-xs leading-relaxed text-on-surface-variant">
                Our funeral order of service booklets are available as 4, 8, 12,
                16, 20 and 24 page printed booklets, with premium card covers,
                full-colour printing and free UK delivery.
              </p>
            </div>
          )}

          {tab === "templates" && (
            <div>
              <PanelHeading>Start from a template</PanelHeading>
              <p className="mb-3 font-body text-xs text-on-surface-variant">
                Applies to your front cover — your other pages are kept.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {TEMPLATES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => applyTemplate(item)}
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
                </div>
              </div>

              <div>
                <PanelHeading>Page borders</PanelHeading>
                <div className="grid grid-cols-3 gap-2">
                  {(["single", "double", "triple"] as const).map((variant) => (
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
                      <span
                        aria-hidden
                        className="block h-8 w-6 border border-current"
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
                    </ElementSwatch>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "layers" && (
            <div>
              <PanelHeading>
                Layers — page {pageIndex + 1}
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
                    .map(({ element, index }) => (
                      <li
                        key={element.id}
                        className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${
                          element.id === selectedId
                            ? "border-primary-container bg-surface-container"
                            : "border-outline-variant/40 bg-surface-container-lowest"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedId(element.id)}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        >
                          <LayerIcon element={element} />
                          <span className="truncate font-body text-xs text-on-surface">
                            {layerLabel(element)}
                          </span>
                        </button>
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
                      </li>
                    ))}
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
              selectedId={selectedId}
              editingId={editingId}
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
                <p>— Drag to move, corner handle to resize</p>
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
              {pageIndex + 1}/{doc.pages.length}
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
        {TABS.map(({ id, label, Icon }) => (
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
            className="mx-auto flex max-h-full w-full max-w-5xl flex-col rounded-xl bg-surface p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl text-primary">Preview</h2>
              <button
                type="button"
                aria-label="Close preview"
                onClick={() => setPreview(false)}
                className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container hover:text-primary"
              >
                <X size={18} aria-hidden />
              </button>
            </div>
            <div className="flex flex-wrap justify-center gap-6 overflow-auto pb-2">
              {doc.pages.map((previewPage, index) => (
                <div key={previewPage.id} className="flex flex-col items-center gap-2">
                  <StaticPage page={previewPage} scale={0.45} />
                  <span className="font-body text-xs text-on-surface-variant">
                    Page {index + 1}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={downloadProof}
                disabled={proofState === "generating"}
                className="flex items-center gap-2 rounded-lg border-2 border-primary-container px-5 py-3 font-body text-sm font-medium text-primary-container transition-colors hover:bg-surface-container disabled:opacity-60"
              >
                <FileDown size={16} aria-hidden />
                {proofState === "generating" ? "Generating proof…" : "Download proof PDF"}
              </button>
              <Link
                href="/order-of-service"
                className="flex items-center gap-2 rounded-lg bg-primary-container px-5 py-3 font-body text-sm font-medium text-white transition-colors hover:bg-primary"
              >
                <ShoppingCart size={16} aria-hidden />
                Continue to order
              </Link>
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
  selectedId,
  editingId,
  onSelect,
  onStartDrag,
  onStartEdit,
  onEditText,
  onEndEdit,
  onBackgroundClick,
}: {
  page: DesignPage;
  zoom: number;
  showCut: boolean;
  showSafe: boolean;
  selectedId: string | null;
  editingId: string | null;
  onSelect: (id: string) => void;
  onStartDrag: (
    event: React.PointerEvent,
    element: CanvasElement,
    mode: "move" | "resize",
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
        }}
        className="absolute left-0 top-0 bg-white shadow-[0_8px_40px_rgba(31,26,30,0.18)]"
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

function ElementView({
  element,
  selected,
  editing,
  onSelect,
  onStartDrag,
  onStartEdit,
  onEditText,
  onEndEdit,
}: {
  element: CanvasElement;
  selected: boolean;
  editing: boolean;
  onSelect: () => void;
  onStartDrag: (
    event: React.PointerEvent,
    element: CanvasElement,
    mode: "move" | "resize",
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
  };

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

      {selected && !editing && (
        <div
          role="presentation"
          onPointerDown={(event) => onStartDrag(event, element, "resize")}
          className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize touch-none rounded-full border-2 border-white bg-[#6b2d6a]"
        />
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
  return (
    <div
      className={`h-full w-full overflow-hidden ${
        element.round ? "rounded-full" : ""
      } ${element.src ? "" : "border-2 border-dashed border-[#d3c2cd] bg-[#faf6f8]"}`}
    >
      {element.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={element.src}
          alt=""
          draggable={false}
          className="h-full w-full object-cover"
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
  const color = element.color;
  return (
    <div className="h-full w-full" style={{ border: `1px solid ${color}`, padding: 4 }}>
      {element.variant !== "single" && (
        <div
          className="h-full w-full"
          style={{
            border: `${element.variant === "double" ? 2.5 : 1}px solid ${color}`,
            padding: 4,
          }}
        >
          {element.variant === "triple" && (
            <div className="h-full w-full" style={{ border: `2.5px solid ${color}` }} />
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Static page (preview modal)                                         */
/* ------------------------------------------------------------------ */

function StaticPage({ page, scale }: { page: DesignPage; scale: number }) {
  return (
    <div
      style={{ width: PAGE_W * scale, height: PAGE_H * scale }}
      className="relative shrink-0 overflow-hidden rounded-sm shadow-[0_4px_20px_rgba(31,26,30,0.15)]"
    >
      <div
        style={{
          width: PAGE_W,
          height: PAGE_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
        className="absolute left-0 top-0 bg-white"
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
