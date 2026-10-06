/**
 * Customer-made artwork — the "Upload your own design" flow (/upload).
 *
 * Pure and DB-free, like designReadiness.ts: the server reads facts out of
 * the PDF once (src/lib/pdfAnalysis.ts → ArtworkAnalysis, stored on the
 * artwork_uploads row), and evaluateArtwork() turns those facts into the
 * checks the customer sees, against whatever product and page count they
 * have chosen. Keeping the two apart is what lets a customer go back and
 * change their mind in step 1 without the file being downloaded and parsed
 * again.
 *
 * The same split as the editor's pre-order check: a fault that can't print
 * properly blocks (wrong size, wrong number of pages, a file we can't open);
 * something that will print but may disappoint warns (no bleed, a soft photo,
 * a font left out of the file), and the customer can choose to print it as
 * it is. The server re-runs the evaluation when the line is added — the
 * client's copy is a display, never a verdict the server trusts.
 */
import {
  BLEED_MM,
  trimText,
  type PageTrim,
  type ProductFormat,
} from "@/lib/designEditor";

/** The only file type accepted — the print PDF Canva and every DTP tool export. */
export const ARTWORK_CONTENT_TYPE = "application/pdf";

/**
 * Larger than a photo upload (MAX_UPLOAD_BYTES): a 24-page booklet with a
 * photo on every page comes out of Canva at tens of megabytes. The server
 * downloads and parses the whole file to check it, which is what caps this.
 */
export const MAX_ARTWORK_BYTES = 50 * 1024 * 1024;

/** Below this, at the size it will be printed, a photograph starts to look soft. */
export const MIN_PRINT_PPI = 150;

/** Edges within this of each other are the same size — PDF exporters round. */
const TOLERANCE_MM = 1.5;

/* ------------------------------------------------------------------ */
/* What the server found in the file                                   */
/* ------------------------------------------------------------------ */

export interface BoxMm {
  w: number;
  h: number;
}

export interface AnalysedPage {
  /** The page as it displays (after /Rotate), in mm. */
  mediaMm: BoxMm;
  /** Only when the PDF declares a TrimBox — the finished size it intends. */
  trimMm?: BoxMm;
  /** With a TrimBox: the narrowest margin of artwork beyond it, in mm. */
  bleedMm?: number;
  /**
   * The lowest resolution of any sizeable image on the page, in pixels per
   * inch at the file's own size. Absent when the page has no such image.
   */
  minImagePpi?: number;
}

export type ArtworkAnalysis =
  | {
      ok: true;
      pageCount: number;
      pages: AnalysedPage[];
      /** Fonts that draw visible text but aren't in the file, subset prefix removed. */
      unembeddedFonts: string[];
      /**
       * The file is encrypted. Its page sizes are still readable, but its
       * content isn't, so photos and fonts went unchecked.
       */
      encrypted: boolean;
      /**
       * 1-based pages whose content couldn't be walked to the end — it broke
       * off, or the file ran past the operator ceiling — so their photos and
       * fonts went unchecked. Absent on analyses stored before it existed.
       */
      uncheckedPages?: number[];
    }
  | { ok: false; reason: "unreadable" | "empty" };

/* ------------------------------------------------------------------ */
/* What the customer is shown                                          */
/* ------------------------------------------------------------------ */

export type ArtworkCheckStatus = "pass" | "warn" | "block";

export interface ArtworkCheck {
  /** "bleed" is the no-bleed warning when a worse size warning leads; "content", pages left unchecked. */
  id: "file" | "size" | "bleed" | "pages" | "photos" | "fonts" | "content";
  status: ArtworkCheckStatus;
  title: string;
  detail: string;
  /** A fix the flow can apply itself: the file has a page count we also sell. */
  switchPages?: { optionId: string; label: string };
}

export interface ArtworkReport {
  checks: ArtworkCheck[];
  /** Something can't be printed — only a different file (or option) gets past it. */
  blocking: boolean;
  /** Something will print but may disappoint — needs "print it as it is". */
  warnings: boolean;
}

export interface PageOptionLike {
  id: string;
  label: string;
  pages: number;
}

/** What the file is being checked against: the customer's step-1 choice. */
export interface ArtworkTarget {
  format: ProductFormat;
  pages: PageOptionLike;
  /** The product's every page-count option, so a mismatch can offer a switch. */
  pageOptions: readonly PageOptionLike[];
}

/**
 * An uploaded-artwork order line's permanent record (order_items
 * .artwork_snapshot): which file, what it was checked against and told, and
 * when the customer accepted any warnings and confirmed the wording.
 */
export interface ArtworkSnapshot {
  source: "pdf" | "canva";
  fileName: string | null;
  url: string | null;
  storageKey: string | null;
  byteSize: number | null;
  canvaUrl: string | null;
  /** The file's own page count; null for a Canva link nobody has opened yet. */
  pageCount: number | null;
  /** The product's trim at the time — the size the press cuts to. */
  trim: PageTrim;
  /** The checks exactly as shown. Empty for a Canva link (staff check those). */
  checks: ArtworkCheck[];
  /** ISO time the customer chose "Print it as it is"; null when nothing warned. */
  warningsAcceptedAt: string | null;
  /** ISO time of the "I've checked the names, dates and spelling" tick. */
  confirmedAt: string;
}

/* ------------------------------------------------------------------ */
/* Evaluation                                                          */
/* ------------------------------------------------------------------ */

const near = (a: number, b: number, tolerance = TOLERANCE_MM) => Math.abs(a - b) <= tolerance;
const fits = (box: BoxMm, w: number, h: number) => near(box.w, w) && near(box.h, h);
const ratio = (w: number, h: number) => w / h;
const sameShape = (box: BoxMm, w: number, h: number) =>
  Math.abs(ratio(box.w, box.h) - ratio(w, h)) <= ratio(w, h) * 0.015;
const mm = (value: number) => Math.round(value);
const boxText = (box: BoxMm) => `${mm(box.w)} × ${mm(box.h)} mm`;

/** The ISO A sizes, for a board whose page-count option is a print size. */
const A_SIZES: Record<string, PageTrim> = {
  A0: { widthMm: 841, heightMm: 1189 },
  A1: { widthMm: 594, heightMm: 841 },
  A2: { widthMm: 420, heightMm: 594 },
  A3: { widthMm: 297, heightMm: 420 },
  A4: { widthMm: 210, heightMm: 297 },
  A5: { widthMm: 148, heightMm: 210 },
  A6: { widthMm: 105, heightMm: 148 },
};

/**
 * The size an option prints at: its A size for a board, else the trim. The
 * label is admin-editable copy ("A1", "A1 easel", "Large (A1)"), so an A size
 * is looked for anywhere in it, then in the option's slug.
 */
export function printTrim(format: ProductFormat, option: { id?: string; label: string }): PageTrim {
  if (!format.sizedByOption) return format.trim;
  for (const text of [option.label, option.id ?? ""]) {
    const match = /(?:^|[^a-z0-9])(a[0-6])(?![0-9])/i.exec(text);
    if (match) return A_SIZES[match[1].toUpperCase()];
  }
  return format.trim;
}

type PageFit =
  /** The product's size with artwork beyond the trim. */
  | "bleed"
  /** The product's size, cut exactly at the edge. */
  | "exact"
  /** The right shape at another size. */
  | "scaled"
  | "rotated"
  /** Two pages side by side on each sheet. */
  | "spread"
  | "wrong";

const FIT_RANK: Record<PageFit, number> = {
  bleed: 0,
  exact: 1,
  scaled: 2,
  rotated: 3,
  spread: 4,
  wrong: 5,
};

/**
 * How a page's box (mm) sits around a w × h trim when no TrimBox says so: an
 * equal margin on every side is bleed — or bleed plus crop marks, which is
 * how Canva's "PDF Print" with crop marks comes out — and none is an exact
 * cut. Unequal margins are a different size altogether.
 */
function marginFit(box: BoxMm, w: number, h: number): "bleed" | "exact" | null {
  const marginX = (box.w - w) / 2;
  const marginY = (box.h - h) / 2;
  if (!near(marginX, marginY, 1)) return null;
  if (Math.abs(marginX) <= 1) return "exact";
  if (marginX >= 2 && marginX <= 25) return "bleed";
  return null;
}

function fitPage(page: AnalysedPage, trim: PageTrim): { fit: PageFit; box: BoxMm } {
  const { widthMm: w, heightMm: h } = trim;
  if (page.trimMm) {
    const box = page.trimMm;
    if (fits(box, w, h)) return { fit: (page.bleedMm ?? 0) >= 2 ? "bleed" : "exact", box };
    if (fits(box, h, w)) return { fit: "rotated", box };
    if (fits(box, w * 2, h)) return { fit: "spread", box };
    if (sameShape(box, w, h)) return { fit: "scaled", box };
    if (sameShape(box, h, w)) return { fit: "rotated", box };
    return { fit: "wrong", box };
  }
  const box = page.mediaMm;
  const direct = marginFit(box, w, h);
  if (direct) return { fit: direct, box: { w, h } };
  if (marginFit(box, h, w)) return { fit: "rotated", box };
  if (marginFit(box, w * 2, h)) return { fit: "spread", box };
  if (sameShape(box, w, h) || sameShape(box, w + BLEED_MM * 2, h + BLEED_MM * 2)) {
    return { fit: "scaled", box };
  }
  if (sameShape(box, h, w)) return { fit: "rotated", box };
  return { fit: "wrong", box };
}

/**
 * A page's fit for the target. A board prints its one design at the A size
 * chosen, so it is measured against both its drawing size and that print
 * size, and any other A-shaped file is simply scaled to it — the model the
 * board is sold on, not a compromise worth a warning.
 */
function fitFor(page: AnalysedPage, target: ArtworkTarget): { fit: PageFit; box: BoxMm } {
  const drawn = fitPage(page, target.format.trim);
  if (!target.format.sizedByOption) return drawn;
  const printed = fitPage(page, printTrim(target.format, target.pages));
  const best = FIT_RANK[printed.fit] < FIT_RANK[drawn.fit] ? printed : drawn;
  // Bleed can't be judged on a file that is scaled to the print, so it isn't
  // asked of one printed at its own size either: both simply pass.
  return best.fit === "scaled" || best.fit === "exact" ? { fit: "bleed", box: best.box } : best;
}

/** "page 3", "pages 3 and 5", "pages 2, 4 and 6" */
export function pagesText(pages: readonly number[]): string {
  if (pages.length === 1) return `page ${pages[0]}`;
  const head = pages.slice(0, -1).join(", ");
  return `pages ${head} and ${pages[pages.length - 1]}`;
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/**
 * The size check: the worst fit of any page leads. When that is a scaled
 * page, pages without bleed get their own warning too — the customer is
 * accepting both with "Print it as it is". A blocking fit needs a new file
 * anyway, so it stands alone.
 */
function sizeChecks(
  analysis: Extract<ArtworkAnalysis, { ok: true }>,
  target: ArtworkTarget,
  fitted: { fit: PageFit; box: BoxMm }[],
): ArtworkCheck[] {
  const effective = fitted.map(({ fit }) => fit);
  const worstRank = Math.max(...effective.map((fit) => FIT_RANK[fit]));
  const worst = (Object.keys(FIT_RANK) as PageFit[]).find((fit) => FIT_RANK[fit] === worstRank)!;
  const checks = [fitCheck(analysis, target, fitted, worst)];
  if (worst === "scaled" && effective.includes("exact")) {
    checks.push({ ...fitCheck(analysis, target, fitted, "exact"), id: "bleed" });
  }
  return checks;
}

/** The check for the pages that fit `fit`. */
function fitCheck(
  analysis: Extract<ArtworkAnalysis, { ok: true }>,
  target: ArtworkTarget,
  fitted: { fit: PageFit; box: BoxMm }[],
  fit: PageFit,
): ArtworkCheck {
  const { format } = target;
  const trim = format.trim;
  const offending = fitted.flatMap((page, index) => (page.fit === fit ? [index + 1] : []));
  const where =
    offending.length === analysis.pageCount
      ? ""
      : ` (${pagesText(offending)})`;
  const first = fitted[offending[0] - 1];
  const portrait = trim.heightMm >= trim.widthMm;
  const sizeName = format.sizedByOption
    ? `The right shape to print at ${target.pages.label}`
    : format.sizeLabel;

  switch (fit) {
    case "bleed":
      return {
        id: "size",
        status: "pass",
        title: "The right size",
        // A board's file may be any A size, scaled to the print — whether it
        // carries bleed isn't knowable then, so don't claim it.
        detail: format.sizedByOption
          ? `${sizeName}.`
          : `${sizeName}, with bleed, ready to print${format.templatePages === 3 ? " and fold" : ""}.`,
      };
    case "exact":
      return {
        id: "size",
        status: "warn",
        title: "No bleed around the edges",
        detail: `It’s the right size, but has no extra margin for trimming${where}. If colour or a picture runs right to the edge, a thin white line may show once it’s cut.`,
      };
    case "scaled": {
      const smaller = first.box.w > trim.widthMm;
      return {
        id: "size",
        status: "warn",
        title: `Your file is ${boxText(first.box)}`,
        detail: `It’s the right shape, so we’ll scale it to fit ${format.sizeLabel} (${trimText(trim)})${where}. Everything on the page will print a little ${smaller ? "smaller" : "larger"} than in your file.`,
      };
    }
    case "rotated":
      return {
        id: "size",
        status: "block",
        title: "Your pages are the wrong way round",
        detail: `This is printed ${portrait ? "portrait" : "landscape"} (${trimText(trim)}), but your file is ${portrait ? "landscape" : "portrait"}${where}. Please turn your design round and upload it again.`,
      };
    case "spread":
      return {
        id: "size",
        status: "block",
        title: "Your pages are side by side",
        detail: `Each sheet of your file holds two pages${where}. We need one page per sheet — please download it again without spreads, or call us and we’ll help.`,
      };
    case "wrong":
      return {
        id: "size",
        status: "block",
        title: "Your file is the wrong size",
        detail: `It’s ${boxText(first.box)}${where}, but this is printed at ${trimText(trim)}${format.sizedByOption ? " or the same shape larger" : ""}. Please make your design at that size and upload it again.`,
      };
  }
}

/** A page-count option as a customer reads it: "8 pages" for a booklet, else its label. */
export function pageOptionText(format: ProductFormat, option: PageOptionLike): string {
  return format.templatePages === 3 ? `${option.pages} ${plural(option.pages, "page", "pages")}` : option.label;
}

function pagesCheck(pageCount: number, target: ArtworkTarget): ArtworkCheck {
  const expected = target.pages.pages;
  const optionText = (option: PageOptionLike) => pageOptionText(target.format, option);
  const count = `${pageCount} ${plural(pageCount, "page", "pages")}`;
  if (pageCount === expected) {
    return { id: "pages", status: "pass", title: count, detail: "Matches what you ordered." };
  }
  if (target.format.templatePages === 2 && expected === 2 && pageCount === 1) {
    return {
      id: "pages",
      status: "warn",
      title: "Only one page",
      detail: "We’ll print it on the front and leave the back blank.",
    };
  }

  const title = `Your file has ${count}`;
  const match = target.format.sizedByOption
    ? undefined
    : target.pageOptions.find((option) => option.pages === pageCount);
  if (match) {
    return {
      id: "pages",
      status: "block",
      title,
      detail: `You chose ${optionText(target.pages)}. Switch to ${optionText(match)} to print it as it is, or upload a different file.`,
      switchPages: { optionId: match.id, label: optionText(match) },
    };
  }
  if (target.format.templatePages === 1) {
    return {
      id: "pages",
      status: "block",
      title,
      detail: "This prints a single page. Please upload a file with just the one page.",
    };
  }
  if (target.format.templatePages === 2) {
    return {
      id: "pages",
      status: "block",
      title,
      detail: "This prints a front and a back. Please upload a file with two pages.",
    };
  }
  const next = target.pageOptions
    .map((option) => option.pages)
    .filter((pages) => pages > pageCount)
    .sort((a, b) => a - b)[0];
  return {
    id: "pages",
    status: "block",
    title,
    detail:
      next === undefined
        ? "That’s more pages than we print in one booklet — please call us and we’ll help."
        : `Booklets are folded, so pages come in fours. Add ${next - pageCount} blank ${plural(next - pageCount, "page", "pages")} to make ${next}, or call us and we’ll help.`,
  };
}

function photosCheck(
  analysis: Extract<ArtworkAnalysis, { ok: true }>,
  target: ArtworkTarget,
  fitted: { fit: PageFit; box: BoxMm }[],
): ArtworkCheck | null {
  const printWidth = printTrim(target.format, target.pages).widthMm;
  let hasImages = false;
  const soft: number[] = [];
  analysis.pages.forEach((page, index) => {
    if (page.minImagePpi === undefined) return;
    hasImages = true;
    // The file's pixels spread over the printed width: a photo that is sharp
    // on an A4 file is soft once that file is printed at A1.
    const fileWidth = fitted[index].box.w;
    const printedPpi = page.minImagePpi * (fileWidth / printWidth);
    if (printedPpi < MIN_PRINT_PPI) soft.push(index + 1);
  });
  if (!hasImages) return null;
  if (soft.length === 0) {
    return { id: "photos", status: "pass", title: "Photos", detail: "Sharp enough to print well." };
  }
  return {
    id: "photos",
    status: "warn",
    title:
      soft.length === 1
        ? `The photo on page ${soft[0]} may print slightly blurry`
        : `Photos on ${pagesText(soft)} may print slightly blurry`,
    detail: `${soft.length === 1 ? "It’s a small image" : "They’re small images"} for ${soft.length === 1 ? "its" : "their"} size on the page. A larger copy of the photo will look sharper.`,
  };
}

function fontsCheck(analysis: Extract<ArtworkAnalysis, { ok: true }>): ArtworkCheck {
  if (analysis.unembeddedFonts.length === 0) {
    return {
      id: "fonts",
      status: "pass",
      title: "Text and fonts",
      detail: "Everything is included in the file.",
    };
  }
  const names = analysis.unembeddedFonts;
  return {
    id: "fonts",
    status: "warn",
    title: `${plural(names.length, "A font isn’t", "Some fonts aren’t")} included in the file`,
    detail: `Text in ${names.slice(0, 3).join(", ")}${names.length > 3 ? " and others" : ""} may print in a different typeface. Saving it again as a print PDF usually includes them.`,
  };
}

/** Check a file's facts against what the customer has chosen to print. */
export function evaluateArtwork(analysis: ArtworkAnalysis, target: ArtworkTarget): ArtworkReport {
  if (!analysis.ok) {
    const checks: ArtworkCheck[] = [
      {
        id: "file",
        status: "block",
        title: "We couldn’t open your file",
        detail:
          analysis.reason === "empty"
            ? "It doesn’t have any pages. Please download it again and upload the new copy."
            : "It may be damaged, or not a PDF. Please download it again and upload the new copy, or call us and we’ll help.",
      },
    ];
    return { checks, blocking: true, warnings: false };
  }

  const fitted = analysis.pages.map((page) => fitFor(page, target));
  const checks: ArtworkCheck[] = sizeChecks(analysis, target, fitted);
  // A file in spreads has twice the pages its sheet count says, so a page
  // count — let alone an offer to switch to it — would only mislead; the
  // size check already says what to do.
  if (!fitted.some(({ fit }) => fit === "spread")) checks.push(pagesCheck(analysis.pageCount, target));
  if (analysis.encrypted) {
    checks.push({
      id: "photos",
      status: "warn",
      title: "We couldn’t look inside your file",
      detail: "It’s protected, so we could only check its size and pages — not its photos or fonts.",
    });
  } else {
    const photos = photosCheck(analysis, target, fitted);
    const fonts = fontsCheck(analysis);
    const unchecked = analysis.uncheckedPages ?? [];
    if (unchecked.length > 0) {
      // A pass would claim pages nobody looked at, so only what was actually
      // found on the checked pages is reported, beside what went unchecked.
      checks.push({
        id: "content",
        status: "warn",
        title: "We couldn’t check every page",
        detail: `Your file is very detailed, so we checked its size and pages, but not the photos or fonts on ${pagesText(unchecked)}.`,
      });
      if (photos?.status === "warn") checks.push(photos);
      if (fonts.status === "warn") checks.push(fonts);
    } else {
      if (photos) checks.push(photos);
      checks.push(fonts);
    }
  }
  return {
    checks,
    blocking: checks.some((check) => check.status === "block"),
    warnings: checks.some((check) => check.status === "warn"),
  };
}

/** The checks the customer is accepting with "Print it as it is". */
export function reportWarnings(report: ArtworkReport): ArtworkCheck[] {
  return report.checks.filter((check) => check.status === "warn");
}

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

/**
 * A Canva design link, normalised to https — or null for anything else. Both
 * the full editor/view link (canva.com/design/…) and Canva's canva.link short
 * links are accepted; staff open it, so it must at least be Canva's.
 */
export function parseCanvaUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 1000) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (host === "canva.link") {
    if (url.pathname.length <= 1) return null;
  } else if (host === "canva.com" || host.endsWith(".canva.com")) {
    if (!url.pathname.startsWith("/design/")) return null;
  } else {
    return null;
  }
  url.protocol = "https:";
  return url.toString();
}

export type ServiceDateResult = { ok: true; date: string | null } | { ok: false; error: string };

/**
 * The optional funeral date from the confirm step: blank, or a real
 * YYYY-MM-DD no earlier than yesterday (the customer's today may be the
 * server's yesterday) and within a year.
 */
export function parseServiceDate(value: unknown, now: Date = new Date()): ServiceDateResult {
  if (value === undefined || value === null || value === "") return { ok: true, date: null };
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { ok: false, error: "Please enter the date of the service as a date" };
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return { ok: false, error: "Please enter a real date for the service" };
  }
  const day = 24 * 60 * 60 * 1000;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (parsed.getTime() < today - day) {
    return { ok: false, error: "The date of the service has already passed" };
  }
  if (parsed.getTime() > today + 366 * day) {
    return { ok: false, error: "Please check the date of the service" };
  }
  return { ok: true, date: value };
}

/** "2.4 MB", "850 KB" */
export function fileSizeText(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/* ------------------------------------------------------------------ */
/* Preview                                                             */
/* ------------------------------------------------------------------ */

export interface PreviewGroup {
  label: string;
  /** 1-based page numbers, shown side by side. */
  pages: number[];
}

/**
 * The file's pages as the customer will hold them: a booklet's front, then
 * each opening (2–3, 4–5 …), then the back; a card's front and back. A file
 * with the wrong number of pages still lays out — leftover pages stand alone
 * — since the preview is what shows them the mismatch.
 */
export function previewGroups(
  pageCount: number,
  templatePages: ProductFormat["templatePages"],
): PreviewGroup[] {
  if (pageCount <= 0) return [];
  if (pageCount === 1) return [{ label: templatePages === 1 ? "Your design" : "Front", pages: [1] }];

  const groups: PreviewGroup[] = [{ label: "Front", pages: [1] }];
  let page = 2;
  if (templatePages === 3) {
    for (; page + 1 < pageCount; page += 2) {
      groups.push({ label: `Pages ${page}–${page + 1}`, pages: [page, page + 1] });
    }
  }
  for (; page < pageCount; page += 1) groups.push({ label: `Page ${page}`, pages: [page] });
  groups.push({ label: "Back", pages: [pageCount] });
  return groups;
}

/** The line above the preview: how the pages are laid out. */
export function previewCaption(templatePages: ProductFormat["templatePages"]): string {
  if (templatePages === 3) return "Shown in the order the pages will be folded";
  return templatePages === 2 ? "Front and back" : "";
}
