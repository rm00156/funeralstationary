/**
 * Document model for the /design editor.
 *
 * Coordinates are stored as percentages of the page (x/w against page width,
 * y/h against page height) so a document is independent of zoom level.
 * Font sizes are px at the base page size (PAGE_W x PAGE_H) and scale with
 * the page via CSS transform.
 */

import type { Template } from "@/lib/templates";

/**
 * Base on-screen sizing at 100% zoom, 3px/mm.
 *
 * PAGE_W/PAGE_H are the trim size — A5 portrait (148 x 210mm), the finished
 * cut size and the coordinate system every element's x/y/w/h percentage is
 * measured against. BLEED_PX is a 3mm bleed margin that extends beyond the
 * trim on every side; ARTBOARD_W/ARTBOARD_H (trim + bleed both sides) is
 * only used for rendering and zoom-to-fit, never for element coordinates.
 */
export const PAGE_W_MM = 148;
export const PAGE_H_MM = 210;
export const PAGE_W = 444;
export const PAGE_H = 630;
export const BLEED_MM = 3;
export const BLEED_PX = (PAGE_W / PAGE_W_MM) * BLEED_MM;
export const ARTBOARD_W_MM = PAGE_W_MM + BLEED_MM * 2;
export const ARTBOARD_H_MM = PAGE_H_MM + BLEED_MM * 2;
export const ARTBOARD_W = PAGE_W + BLEED_PX * 2;
export const ARTBOARD_H = PAGE_H + BLEED_PX * 2;

export type FontFamilyId = "display" | "body" | "script";

export interface FontOption {
  id: FontFamilyId;
  label: string;
  css: string;
}

export const FONT_OPTIONS: FontOption[] = [
  { id: "display", label: "Source Serif", css: "var(--font-display)" },
  { id: "body", label: "Work Sans", css: "var(--font-body)" },
  { id: "script", label: "Script", css: "var(--font-script), cursive" },
];

/** Muted ink palette for on-page content ("Serene Legacy" friendly). */
export const INK_PALETTE = [
  "#1f1a1e",
  "#4f434c",
  "#511552",
  "#6b2d6a",
  "#226b3d",
  "#5b4a2f",
  "#33506b",
  "#81737d",
  "#ffffff",
];

interface ElementBase {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TextElement extends ElementBase {
  type: "text";
  text: string;
  fontFamily: FontFamilyId;
  fontSize: number;
  bold?: boolean;
  italic?: boolean;
  align: "left" | "center" | "right";
  color: string;
  letterSpacing?: number;
  uppercase?: boolean;
}

export interface ImageElement extends ElementBase {
  type: "image";
  /** Data/blob URL, or null for an empty photo placeholder. */
  src: string | null;
  round?: boolean;
}

export interface ShapeElement extends ElementBase {
  type: "shape";
  shape: "rect" | "circle" | "line";
  color: string;
  strokeWidth: number;
}

export interface ClipartElement extends ElementBase {
  type: "clipart";
  icon: string;
  color: string;
}

export interface FrameElement extends ElementBase {
  type: "frame";
  variant: "single" | "double" | "triple";
  color: string;
}

export type CanvasElement =
  | TextElement
  | ImageElement
  | ShapeElement
  | ClipartElement
  | FrameElement;

export interface DesignPage {
  id: string;
  elements: CanvasElement[];
}

export interface DesignDoc {
  templateId: string;
  pages: DesignPage[];
}

let counter = 0;
export function uid(prefix = "el") {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

/** Accent colour a template's starter layout uses, keyed off its first category. */
const CATEGORY_ACCENTS: Record<string, string> = {
  floral: "#6b2d6a",
  nature: "#226b3d",
  calm: "#226b3d",
  birds: "#226b3d",
  religious: "#5b4a2f",
  military: "#33506b",
  sport: "#33506b",
  classic: "#1f1a1e",
  modern: "#1f1a1e",
  minimalistic: "#81737d",
  simple: "#81737d",
  colourful: "#6b2d6a",
};

export function templateAccent(template: Template): string {
  for (const category of template.categories) {
    const accent = CATEGORY_ACCENTS[category];
    if (accent) return accent;
  }
  return "#1f1a1e";
}

function coverElements(template: Template): CanvasElement[] {
  const accent = templateAccent(template);
  return [
    {
      id: uid("frame"),
      type: "frame",
      variant: "triple",
      color: accent,
      x: 4,
      y: 3,
      w: 92,
      h: 94,
    },
    {
      id: uid("text"),
      type: "text",
      text: "Celebrating",
      fontFamily: "script",
      fontSize: 46,
      align: "center",
      color: "#1f1a1e",
      x: 10,
      y: 9.5,
      w: 80,
      h: 0,
    },
    {
      id: uid("text"),
      type: "text",
      text: "The life of",
      fontFamily: "body",
      fontSize: 13,
      align: "center",
      color: "#4f434c",
      uppercase: true,
      letterSpacing: 3,
      x: 15,
      y: 21,
      w: 70,
      h: 0,
    },
    {
      id: uid("image"),
      type: "image",
      src: null,
      round: true,
      x: 30,
      y: 27.5,
      w: 40,
      h: 28.2,
    },
    {
      id: uid("text"),
      type: "text",
      text: "Robert Bayne",
      fontFamily: "display",
      fontSize: 30,
      align: "center",
      color: "#1f1a1e",
      uppercase: true,
      letterSpacing: 1.5,
      x: 8,
      y: 61,
      w: 84,
      h: 0,
    },
    {
      id: uid("text"),
      type: "text",
      text: "1971 – 2024",
      fontFamily: "body",
      fontSize: 15,
      align: "center",
      color: "#4f434c",
      letterSpacing: 1,
      x: 20,
      y: 70.5,
      w: 60,
      h: 0,
    },
  ];
}

function orderPageElements(): CanvasElement[] {
  return [
    {
      id: uid("text"),
      type: "text",
      text: "Order of Service",
      fontFamily: "display",
      fontSize: 24,
      align: "center",
      color: "#1f1a1e",
      x: 10,
      y: 8,
      w: 80,
      h: 0,
    },
    {
      id: uid("shape"),
      type: "shape",
      shape: "line",
      color: "#81737d",
      strokeWidth: 1,
      x: 35,
      y: 14.5,
      w: 30,
      h: 0.3,
    },
    {
      id: uid("text"),
      type: "text",
      text: "Opening Music\n\nWelcome & Introduction\n\nHymn — Abide With Me\n\nEulogy\n\nReading\n\nPrayers\n\nClosing Words",
      fontFamily: "body",
      fontSize: 14,
      align: "center",
      color: "#4f434c",
      x: 12,
      y: 20,
      w: 76,
      h: 0,
    },
  ];
}

function backPageElements(): CanvasElement[] {
  return [
    {
      id: uid("clipart"),
      type: "clipart",
      icon: "flower",
      color: "#81737d",
      x: 44,
      y: 26,
      w: 12,
      h: 8.5,
    },
    {
      id: uid("text"),
      type: "text",
      text: "Forever in our hearts",
      fontFamily: "script",
      fontSize: 30,
      align: "center",
      color: "#1f1a1e",
      x: 10,
      y: 38,
      w: 80,
      h: 0,
    },
    {
      id: uid("text"),
      type: "text",
      text: "The family would like to thank you\nfor your kindness, support and\npresence here today.",
      fontFamily: "body",
      fontSize: 13,
      align: "center",
      color: "#4f434c",
      x: 15,
      y: 52,
      w: 70,
      h: 0,
    },
  ];
}

export function makeBlankPage(): DesignPage {
  return { id: uid("page"), elements: [] };
}

/** Starter document for a template: cover, order pages, back page. */
export function makeStarterDoc(template: Template, pageCount: number): DesignDoc {
  const pages: DesignPage[] = [];
  for (let index = 0; index < pageCount; index += 1) {
    if (index === 0) {
      pages.push({ id: uid("page"), elements: coverElements(template) });
    } else if (index === pageCount - 1) {
      pages.push({ id: uid("page"), elements: backPageElements() });
    } else if (index === 1) {
      pages.push({ id: uid("page"), elements: orderPageElements() });
    } else {
      pages.push(makeBlankPage());
    }
  }
  return { templateId: template.id, pages };
}

/** Grow or shrink a document to the requested page count. */
export function withPageCount(doc: DesignDoc, pageCount: number): DesignDoc {
  if (doc.pages.length === pageCount) return doc;
  if (doc.pages.length > pageCount) {
    return { ...doc, pages: doc.pages.slice(0, pageCount) };
  }
  const pages = [...doc.pages];
  while (pages.length < pageCount) pages.push(makeBlankPage());
  return { ...doc, pages };
}

export const storageKey = (templateId: string) => `tfs-design:${templateId}`;

/** POST body for /api/proof — everything /proof-render needs to reproduce the canvas. */
export interface ProofRequest {
  doc: DesignDoc;
}
