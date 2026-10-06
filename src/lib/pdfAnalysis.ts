/**
 * Reads the printing facts out of a customer's PDF — page sizes and bleed,
 * how sharp its photos are at the size they're placed, and whether its fonts
 * travel with it — for the upload flow's "We've checked your file" step.
 *
 * Pure (bytes in, ArtworkAnalysis out) and built only on pdf-lib, which the
 * press PDF already uses; nothing here renders. The judgement — what is the
 * right size, what is too soft — lives in evaluateArtwork (artwork.ts), so
 * this records facts about the file and nothing about the order.
 *
 * Photo resolution needs to know how large each image is drawn, which only
 * the page's content stream says (`cm` operators scaling the unit square an
 * image is painted into). pdf-lib parses objects but not content, so a small
 * tokenizer below walks the operators that matter — q/Q/cm/Do, plus Tf/Tr and
 * the text-showing operators for fonts — recursing into form XObjects.
 */
import {
  PDFArray,
  PDFBool,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  decodePDFRawStream,
  type PDFObject,
  type PDFPage,
} from "pdf-lib";
import type { AnalysedPage, ArtworkAnalysis, BoxMm } from "@/lib/artwork";

const PT_TO_MM = 25.4 / 72;

/**
 * Images smaller than this on the page (mm, shorter side) aren't judged —
 * a soft logo or ornament is not what a customer means by a blurry photo.
 */
const MIN_IMAGE_MM = 25;
/**
 * Nor are images this few pixels across: exporters paint flat colour and
 * gradients as tiny images stretched over the page, which can't look blurry.
 */
const MIN_IMAGE_PX = 16;
/** Form XObjects nested deeper than this are not followed. */
const MAX_FORM_DEPTH = 12;
/** A ceiling on operators walked per file, so a pathological PDF can't stall the check. */
const MAX_OPERATORS = 3_000_000;

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** m × n, in PDF's row-vector convention: apply m, then n. */
function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[1] * n[2],
    m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4],
    m[4] * n[1] + m[5] * n[3] + n[5],
  ];
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Content-stream tokens are bytes, not UTF-8; latin1 maps each one to a char. */
const latin1 = new TextDecoder("latin1");

/* ------------------------------------------------------------------ */
/* Object helpers                                                      */
/* ------------------------------------------------------------------ */

const name = (value: string) => PDFName.of(value);

function asDict(doc: PDFDocument, value: PDFObject | undefined): PDFDict | undefined {
  const resolved = value instanceof PDFRef ? doc.context.lookup(value) : value;
  if (resolved instanceof PDFDict) return resolved;
  if (resolved instanceof PDFRawStream) return resolved.dict;
  return undefined;
}

function numberAt(dict: PDFDict, key: string): number | undefined {
  const value = dict.lookup(name(key));
  return value instanceof PDFNumber ? value.asNumber() : undefined;
}

function nameAt(dict: PDFDict, key: string): string | undefined {
  const value = dict.lookup(name(key));
  return value instanceof PDFName ? value.decodeText() : undefined;
}

function streamBytes(stream: PDFRawStream): Uint8Array | null {
  try {
    return decodePDFRawStream(stream).decode();
  } catch {
    // An unsupported or broken filter: skip what can't be read rather than
    // failing the whole check.
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Content stream tokenizer                                            */
/* ------------------------------------------------------------------ */

const CHAR = (c: string) => c.charCodeAt(0);
const isWhite = (b: number) => b === 0 || b === 9 || b === 10 || b === 12 || b === 13 || b === 32;
const DELIMITERS = new Set([..."()<>[]{}/%"].map(CHAR));
const isRegular = (b: number) => !isWhite(b) && !DELIMITERS.has(b);

type Operand = number | { name: string } | null;

/**
 * Calls `onOperator` for each operator with the operands before it. Strings,
 * arrays and dictionaries are skipped over (their contents become `null`
 * operands, or nothing) — none of the operators read here takes one.
 */
function tokenize(
  bytes: Uint8Array,
  onOperator: (operator: string, operands: Operand[]) => boolean,
): void {
  const operands: Operand[] = [];
  let i = 0;
  const n = bytes.length;
  while (i < n) {
    const b = bytes[i];
    if (isWhite(b)) {
      i += 1;
    } else if (b === CHAR("%")) {
      while (i < n && bytes[i] !== 10 && bytes[i] !== 13) i += 1;
    } else if (b === CHAR("(")) {
      let depth = 1;
      i += 1;
      while (i < n && depth > 0) {
        if (bytes[i] === CHAR("\\")) i += 2;
        else {
          if (bytes[i] === CHAR("(")) depth += 1;
          else if (bytes[i] === CHAR(")")) depth -= 1;
          i += 1;
        }
      }
      operands.push(null);
    } else if (b === CHAR("<")) {
      if (bytes[i + 1] === CHAR("<")) {
        i += 2;
      } else {
        while (i < n && bytes[i] !== CHAR(">")) i += 1;
        i += 1;
        operands.push(null);
      }
    } else if (b === CHAR(">")) {
      i += bytes[i + 1] === CHAR(">") ? 2 : 1;
    } else if (b === CHAR("[") || b === CHAR("]") || b === CHAR("{") || b === CHAR("}")) {
      i += 1;
    } else if (b === CHAR("/")) {
      const start = (i += 1);
      while (i < n && isRegular(bytes[i])) i += 1;
      const raw = latin1.decode(bytes.subarray(start, i));
      operands.push({ name: raw.replace(/#([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))) });
    } else {
      const start = i;
      while (i < n && isRegular(bytes[i])) i += 1;
      if (i === start) {
        i += 1; // a stray delimiter; step over it
        continue;
      }
      const token = latin1.decode(bytes.subarray(start, i));
      if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(token)) {
        operands.push(parseFloat(token));
        continue;
      }
      if (token === "BI") {
        // An inline image: its data is binary and may contain anything, so
        // jump from ID to the whitespace-delimited EI that ends it.
        let j = i;
        while (j + 2 < n && !(isWhite(bytes[j]) && bytes[j + 1] === CHAR("I") && bytes[j + 2] === CHAR("D") && (j + 3 >= n || isWhite(bytes[j + 3])))) j += 1;
        j += 4;
        while (j + 2 < n && !(isWhite(bytes[j]) && bytes[j + 1] === CHAR("E") && bytes[j + 2] === CHAR("I") && (j + 3 >= n || isWhite(bytes[j + 3])))) j += 1;
        i = j + 3;
        operands.length = 0;
        continue;
      }
      const keepGoing = onOperator(token, operands.slice());
      operands.length = 0;
      if (!keepGoing) return;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Walking a page                                                      */
/* ------------------------------------------------------------------ */

interface FontFacts {
  name: string;
  embedded: boolean;
}

interface WalkState {
  doc: PDFDocument;
  operatorBudget: number;
  /** Lowest ppi of a sizeable image on the current page. */
  minPpi: number | undefined;
  fontCache: Map<PDFDict, FontFacts>;
  unembedded: Set<string>;
}

function fontFacts(state: WalkState, font: PDFDict): FontFacts {
  const cached = state.fontCache.get(font);
  if (cached) return cached;
  const base = (nameAt(font, "BaseFont") ?? "Unnamed font").replace(/^[A-Z]{6}\+/, "");
  const subtype = nameAt(font, "Subtype");
  let embedded = subtype === "Type3"; // glyphs drawn by the file itself
  if (!embedded) {
    let holder: PDFDict | undefined = font;
    if (subtype === "Type0") {
      const descendants = font.lookup(name("DescendantFonts"));
      holder =
        descendants instanceof PDFArray ? asDict(state.doc, descendants.get(0)) : undefined;
    }
    const descriptor = holder ? asDict(state.doc, holder.get(name("FontDescriptor"))) : undefined;
    embedded =
      !!descriptor &&
      ["FontFile", "FontFile2", "FontFile3"].some((key) => descriptor.has(name(key)));
  }
  const facts = { name: base, embedded };
  state.fontCache.set(font, facts);
  return facts;
}

function walk(
  state: WalkState,
  bytes: Uint8Array,
  resources: PDFDict | undefined,
  startCtm: Matrix,
  chain: Set<string>,
): void {
  const xObjects = resources ? asDict(state.doc, resources.get(name("XObject"))) : undefined;
  const fonts = resources ? asDict(state.doc, resources.get(name("Font"))) : undefined;

  let ctm = startCtm;
  let font: PDFDict | undefined;
  let renderMode = 0;
  const stack: { ctm: Matrix; font: PDFDict | undefined; renderMode: number }[] = [];

  tokenize(bytes, (operator, operands) => {
    state.operatorBudget -= 1;
    if (state.operatorBudget <= 0) return false;

    switch (operator) {
      case "q":
        stack.push({ ctm, font, renderMode });
        break;
      case "Q": {
        const saved = stack.pop();
        if (saved) ({ ctm, font, renderMode } = saved);
        break;
      }
      case "cm":
        if (operands.length === 6 && operands.every((value) => typeof value === "number")) {
          ctm = multiply(operands as Matrix, ctm);
        }
        break;
      case "Tf": {
        const key = operands[0];
        font = key && typeof key === "object" && fonts ? asDict(state.doc, fonts.get(name(key.name))) : undefined;
        break;
      }
      case "Tr":
        if (typeof operands[0] === "number") renderMode = operands[0];
        break;
      case "Tj":
      case "TJ":
      case "'":
      case '"':
        // Modes 3 and 7 draw nothing — the hidden text layer of a scan, say —
        // so a missing font there can't change what prints.
        if (font && renderMode !== 3 && renderMode !== 7) {
          const facts = fontFacts(state, font);
          if (!facts.embedded) state.unembedded.add(facts.name);
        }
        break;
      case "Do": {
        const key = operands[0];
        if (!key || typeof key !== "object" || !xObjects) break;
        const ref = xObjects.get(name(key.name));
        const object = ref instanceof PDFRef ? state.doc.context.lookup(ref) : ref;
        if (!(object instanceof PDFRawStream)) break;
        const dict = object.dict;
        const subtype = nameAt(dict, "Subtype");
        if (subtype === "Image") {
          measureImage(state, dict, ctm);
        } else if (subtype === "Form") {
          const id = ref instanceof PDFRef ? ref.toString() : key.name;
          if (chain.has(id) || chain.size >= MAX_FORM_DEPTH) break;
          const content = streamBytes(object);
          if (!content) break;
          const matrix = dict.lookup(name("Matrix"));
          const formMatrix =
            matrix instanceof PDFArray && matrix.size() === 6
              ? (matrix.asArray().map((value) => (value instanceof PDFNumber ? value.asNumber() : 0)) as Matrix)
              : IDENTITY;
          const formResources = asDict(state.doc, dict.get(name("Resources"))) ?? resources;
          walk(state, content, formResources, multiply(formMatrix, ctm), new Set([...chain, id]));
        }
        break;
      }
    }
    return true;
  });
}

function measureImage(state: WalkState, dict: PDFDict, ctm: Matrix): void {
  const imageMask = dict.lookup(name("ImageMask"));
  if (imageMask instanceof PDFBool && imageMask.asBoolean()) return; // a stencil, not a photo
  if (numberAt(dict, "BitsPerComponent") === 1) return; // line art
  const widthPx = numberAt(dict, "Width");
  const heightPx = numberAt(dict, "Height");
  if (!widthPx || !heightPx || widthPx < MIN_IMAGE_PX || heightPx < MIN_IMAGE_PX) return;

  // The image fills the unit square, so the CTM's column lengths are its
  // drawn width and height in points.
  const widthPt = Math.hypot(ctm[0], ctm[1]);
  const heightPt = Math.hypot(ctm[2], ctm[3]);
  if (Math.min(widthPt, heightPt) * PT_TO_MM < MIN_IMAGE_MM) return;

  const ppi = Math.min(widthPx / (widthPt / 72), heightPx / (heightPt / 72));
  state.minPpi = state.minPpi === undefined ? ppi : Math.min(state.minPpi, ppi);
}

function pageContent(doc: PDFDocument, page: PDFPage): Uint8Array {
  const contents = page.node.Contents();
  const streams: PDFObject[] = contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : [];
  const parts: Uint8Array[] = [];
  for (const entry of streams) {
    const stream = entry instanceof PDFRef ? doc.context.lookup(entry) : entry;
    if (!(stream instanceof PDFRawStream)) continue;
    const bytes = streamBytes(stream);
    // Streams in an array are one content stream split at token boundaries;
    // a newline between them keeps the last token of one off the next.
    if (bytes) parts.push(bytes, new Uint8Array([10]));
  }
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.length;
  }
  return joined;
}

/* ------------------------------------------------------------------ */
/* Page boxes                                                          */
/* ------------------------------------------------------------------ */

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function toBox(rect: Rect, quarterTurn: boolean): BoxMm {
  const w = round1(rect.width * PT_TO_MM);
  const h = round1(rect.height * PT_TO_MM);
  return quarterTurn ? { w: h, h: w } : { w, h };
}

function pageBoxes(page: PDFPage): Pick<AnalysedPage, "mediaMm" | "trimMm" | "bleedMm"> {
  const angle = ((page.getRotation().angle % 360) + 360) % 360;
  const quarterTurn = angle === 90 || angle === 270;
  // The crop box is the page as any viewer shows it; it defaults to the media box.
  const crop = page.getCropBox();
  const result: Pick<AnalysedPage, "mediaMm" | "trimMm" | "bleedMm"> = {
    mediaMm: toBox(crop, quarterTurn),
  };
  if (!page.node.TrimBox()) return result;

  const trim = page.getTrimBox();
  const bleed = page.node.BleedBox() ? page.getBleedBox() : crop;
  const margin = Math.min(
    trim.x - bleed.x,
    trim.y - bleed.y,
    bleed.x + bleed.width - (trim.x + trim.width),
    bleed.y + bleed.height - (trim.y + trim.height),
  );
  result.trimMm = toBox(trim, quarterTurn);
  result.bleedMm = round1(Math.max(0, margin) * PT_TO_MM);
  return result;
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

function looksLikePdf(bytes: Uint8Array): boolean {
  const head = latin1.decode(bytes.subarray(0, 1024));
  return head.includes("%PDF-");
}

export async function analysePdf(bytes: Uint8Array): Promise<ArtworkAnalysis> {
  if (!looksLikePdf(bytes)) return { ok: false, reason: "unreadable" };

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, {
      ignoreEncryption: true,
      updateMetadata: false,
      throwOnInvalidObject: false,
    });
  } catch {
    return { ok: false, reason: "unreadable" };
  }

  let pages: PDFPage[];
  try {
    pages = doc.getPages();
  } catch {
    return { ok: false, reason: "unreadable" };
  }
  if (pages.length === 0) return { ok: false, reason: "empty" };

  // With encryption, the object structure (and so the page boxes) is still
  // readable, but every stream is ciphertext.
  const encrypted = doc.isEncrypted;
  const state: WalkState = {
    doc,
    operatorBudget: MAX_OPERATORS,
    minPpi: undefined,
    fontCache: new Map(),
    unembedded: new Set(),
  };

  const analysed: AnalysedPage[] = [];
  for (const page of pages) {
    let boxes: ReturnType<typeof pageBoxes>;
    try {
      boxes = pageBoxes(page);
    } catch {
      return { ok: false, reason: "unreadable" };
    }
    const entry: AnalysedPage = { ...boxes };
    if (!encrypted) {
      state.minPpi = undefined;
      try {
        const resources = asDict(doc, page.node.getInheritableAttribute(name("Resources")));
        walk(state, pageContent(doc, page), resources, IDENTITY, new Set());
      } catch {
        // A page whose content can't be walked still has a size worth checking.
      }
      if (state.minPpi !== undefined) entry.minImagePpi = Math.round(state.minPpi);
    }
    analysed.push(entry);
  }

  return {
    ok: true,
    pageCount: pages.length,
    pages: analysed,
    unembeddedFonts: [...state.unembedded].sort(),
    encrypted,
  };
}
