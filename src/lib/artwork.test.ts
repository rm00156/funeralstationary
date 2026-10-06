import { describe, expect, it } from "vitest";

import {
  evaluateArtwork,
  fileSizeText,
  pagesText,
  parseCanvaUrl,
  parseServiceDate,
  previewCaption,
  previewGroups,
  printTrim,
  reportWarnings,
  type AnalysedPage,
  type ArtworkAnalysis,
  type ArtworkTarget,
} from "@/lib/artwork";
import { BOOKLET_FORMAT, type ProductFormat } from "@/lib/designEditor";

const BOOKLET_PAGES = [4, 8, 12, 16, 20, 24].map((pages) => ({
  id: String(pages),
  label: `${pages} page`,
  pages,
}));

const booklet = (pages = 8): ArtworkTarget => ({
  format: BOOKLET_FORMAT,
  pages: BOOKLET_PAGES.find((option) => option.pages === pages)!,
  pageOptions: BOOKLET_PAGES,
});

const CARD: ProductFormat = {
  sizeLabel: "A6",
  trim: { widthMm: 105, heightMm: 148 },
  templatePages: 2,
  sizedByOption: false,
  paperLabel: "Paper",
};
const card: ArtworkTarget = {
  format: CARD,
  pages: { id: "both-sides", label: "Printed both sides", pages: 2 },
  pageOptions: [{ id: "both-sides", label: "Printed both sides", pages: 2 }],
};

const BOARD: ProductFormat = {
  sizeLabel: "A4 to A0",
  trim: { widthMm: 210, heightMm: 297 },
  templatePages: 1,
  sizedByOption: true,
  paperLabel: "Finish",
};
const BOARD_SIZES = ["a4", "a3", "a1"].map((id) => ({ id, label: id.toUpperCase(), pages: 1 }));
const board = (size = "a1"): ArtworkTarget => ({
  format: BOARD,
  pages: BOARD_SIZES.find((option) => option.id === size)!,
  pageOptions: BOARD_SIZES,
});

/** A5 with 3mm bleed, as Canva's "PDF Print" with bleed comes out. */
const A5_BLEED: AnalysedPage = { mediaMm: { w: 154, h: 216 } };

function file(pages: AnalysedPage[], extra: Partial<Extract<ArtworkAnalysis, { ok: true }>> = {}): ArtworkAnalysis {
  return { ok: true, pageCount: pages.length, pages, unembeddedFonts: [], encrypted: false, ...extra };
}
const repeat = (page: AnalysedPage, count: number) => Array.from({ length: count }, () => page);
const check = (analysis: ArtworkAnalysis, target: ArtworkTarget, id: string) =>
  evaluateArtwork(analysis, target).checks.find((entry) => entry.id === id);

describe("evaluateArtwork — size", () => {
  it("passes the product's size with bleed, from the page alone", () => {
    const report = evaluateArtwork(file(repeat(A5_BLEED, 8)), booklet());
    expect(report.blocking).toBe(false);
    expect(report.warnings).toBe(false);
    expect(report.checks[0]).toMatchObject({
      id: "size",
      status: "pass",
      title: "The right size",
      detail: "A5, with bleed, ready to print and fold.",
    });
  });

  it("passes a declared trim box with bleed around it", () => {
    const page: AnalysedPage = { mediaMm: { w: 180, h: 240 }, trimMm: { w: 148, h: 210 }, bleedMm: 3 };
    expect(check(file(repeat(page, 8)), booklet(), "size")?.status).toBe("pass");
  });

  it("reads equal margins all round as bleed plus crop marks", () => {
    const marks: AnalysedPage = { mediaMm: { w: 148 + 2 * 12.7, h: 210 + 2 * 12.7 } };
    expect(check(file(repeat(marks, 8)), booklet(), "size")?.status).toBe("pass");
  });

  it("warns about an exact-size page with no bleed", () => {
    const exact: AnalysedPage = { mediaMm: { w: 148, h: 210 } };
    const size = check(file(repeat(exact, 8)), booklet(), "size");
    expect(size).toMatchObject({ status: "warn", title: "No bleed around the edges" });
  });

  it("names only the pages without bleed when the rest have it", () => {
    const exact: AnalysedPage = { mediaMm: { w: 148, h: 210 } };
    const pages = [...repeat(A5_BLEED, 7), exact];
    expect(check(file(pages), booklet(), "size")?.detail).toContain("(page 8)");
  });

  it("warns that an A4 file will be scaled down to A5", () => {
    const a4: AnalysedPage = { mediaMm: { w: 210, h: 297 } };
    const size = check(file(repeat(a4, 8)), booklet(), "size");
    expect(size).toMatchObject({ status: "warn", title: "Your file is 210 × 297 mm" });
    expect(size?.detail).toContain("smaller");
  });

  it("still warns about pages without bleed when another page is scaled", () => {
    const exact: AnalysedPage = { mediaMm: { w: 148, h: 210 } };
    const scaled: AnalysedPage = { mediaMm: { w: 210, h: 297 } };
    const report = evaluateArtwork(file([exact, exact, exact, scaled]), booklet(4));
    expect(report.checks.find((entry) => entry.id === "size")?.detail).toContain("(page 4)");
    expect(report.checks.find((entry) => entry.id === "bleed")).toMatchObject({
      status: "warn",
      title: "No bleed around the edges",
    });
    expect(report.checks.find((entry) => entry.id === "bleed")?.detail).toContain("(pages 1, 2 and 3)");
  });

  it("blocks a landscape file for a portrait product", () => {
    const landscape: AnalysedPage = { mediaMm: { w: 216, h: 154 } };
    const report = evaluateArtwork(file(repeat(landscape, 8)), booklet());
    expect(report.blocking).toBe(true);
    expect(report.checks[0].title).toBe("Your pages are the wrong way round");
  });

  it("blocks a booklet laid out in spreads", () => {
    const spread: AnalysedPage = { mediaMm: { w: 296 + 6, h: 216 } };
    const analysis = file(repeat(spread, 4));
    expect(check(analysis, booklet(8), "size")).toMatchObject({
      status: "block",
      title: "Your pages are side by side",
    });
    // Its 4 sheets are 8 pages: no page-count row, and no offer of "4 pages".
    expect(check(analysis, booklet(8), "pages")).toBeUndefined();
  });

  it("blocks a file of another shape", () => {
    const letter: AnalysedPage = { mediaMm: { w: 216, h: 279 } };
    expect(check(file(repeat(letter, 8)), booklet(), "size")).toMatchObject({
      status: "block",
      title: "Your file is the wrong size",
    });
  });

  it("takes any A-shaped file for a board, at the size chosen", () => {
    const a1: AnalysedPage = { mediaMm: { w: 594, h: 841 } };
    const a3: AnalysedPage = { mediaMm: { w: 297, h: 420 } };
    expect(check(file([a1]), board("a1"), "size")?.status).toBe("pass");
    expect(check(file([a3]), board("a1"), "size")).toMatchObject({
      status: "pass",
      detail: "The right shape to print at A1.",
    });
  });
});

describe("evaluateArtwork — pages", () => {
  it("passes the page count that was ordered", () => {
    expect(check(file(repeat(A5_BLEED, 8)), booklet(8), "pages")).toMatchObject({
      status: "pass",
      title: "8 pages",
      detail: "Matches what you ordered.",
    });
  });

  it("offers to switch to the page count the file has", () => {
    const pages = check(file(repeat(A5_BLEED, 12)), booklet(8), "pages");
    expect(pages).toMatchObject({
      status: "block",
      title: "Your file has 12 pages",
      switchPages: { optionId: "12", label: "12 pages" },
    });
    expect(pages?.detail).toBe("You chose 8 pages. Switch to 12 pages to print it as it is, or upload a different file.");
  });

  it("explains that booklet pages come in fours", () => {
    const pages = check(file(repeat(A5_BLEED, 7)), booklet(8), "pages");
    expect(pages?.status).toBe("block");
    expect(pages?.detail).toContain("Add 1 blank page to make 8");
    expect(pages?.switchPages).toBeUndefined();
  });

  it("says when a file has more pages than any booklet", () => {
    expect(check(file(repeat(A5_BLEED, 30)), booklet(24), "pages")?.detail).toContain("more pages than we print");
  });

  it("prints a one-page file on a card's front and leaves the back blank", () => {
    const a6: AnalysedPage = { mediaMm: { w: 111, h: 154 } };
    expect(check(file([a6]), card, "pages")).toMatchObject({ status: "warn", title: "Only one page" });
  });

  it("blocks a multi-page file for a board", () => {
    const a1: AnalysedPage = { mediaMm: { w: 594, h: 841 } };
    expect(check(file([a1, a1]), board(), "pages")).toMatchObject({ status: "block" });
  });
});

describe("evaluateArtwork — photos and fonts", () => {
  it("warns about a soft photo, naming its page", () => {
    const pages = repeat(A5_BLEED, 8).map((page, index) =>
      index === 2 ? { ...page, minImagePpi: 96 } : { ...page, minImagePpi: 300 },
    );
    const report = evaluateArtwork(file(pages), booklet());
    expect(report.checks.find((entry) => entry.id === "photos")).toMatchObject({
      status: "warn",
      title: "The photo on page 3 may print slightly blurry",
    });
    expect(reportWarnings(report).map((entry) => entry.id)).toEqual(["photos"]);
  });

  it("names several soft pages together", () => {
    const pages = repeat({ ...A5_BLEED, minImagePpi: 120 }, 4);
    expect(check(file(pages), booklet(4), "photos")?.title).toBe(
      "Photos on pages 1, 2, 3 and 4 may print slightly blurry",
    );
  });

  it("judges a board's photos at the size it will be printed", () => {
    // 300ppi on an A4 file is under 150ppi once that is printed at A1.
    const a4: AnalysedPage = { mediaMm: { w: 210, h: 297 }, minImagePpi: 300 };
    expect(check(file([a4]), board("a4"), "photos")?.status).toBe("pass");
    expect(check(file([a4]), board("a1"), "photos")?.status).toBe("warn");
  });

  it("leaves out the photo row when there are no photos", () => {
    expect(check(file(repeat(A5_BLEED, 8)), booklet(), "photos")).toBeUndefined();
  });

  it("warns about fonts left out of the file", () => {
    const fonts = check(file(repeat(A5_BLEED, 8), { unembeddedFonts: ["Arial"] }), booklet(), "fonts");
    expect(fonts).toMatchObject({ status: "warn", title: "A font isn’t included in the file" });
    expect(fonts?.detail).toContain("Arial");
  });

  it("passes a file with every font included", () => {
    expect(check(file(repeat(A5_BLEED, 8)), booklet(), "fonts")).toMatchObject({
      status: "pass",
      title: "Text and fonts",
      detail: "Everything is included in the file.",
    });
  });

  it("warns about pages it couldn't walk, rather than passing them", () => {
    const pages = repeat({ ...A5_BLEED, minImagePpi: 300 }, 8);
    const report = evaluateArtwork(file(pages, { uncheckedPages: [6, 7, 8] }), booklet());
    expect(report.checks.map((entry) => entry.id)).toEqual(["size", "pages", "content"]);
    expect(check(file(pages, { uncheckedPages: [6, 7, 8] }), booklet(), "content")?.detail).toContain(
      "pages 6, 7 and 8",
    );
    expect(report.warnings).toBe(true);
  });

  it("still reports what it found on the pages it could check", () => {
    const analysis = file(repeat(A5_BLEED, 8), { uncheckedPages: [8], unembeddedFonts: ["Arial"] });
    expect(evaluateArtwork(analysis, booklet()).checks.map((entry) => entry.id)).toEqual([
      "size",
      "pages",
      "content",
      "fonts",
    ]);
  });

  it("says so when a protected file couldn't be looked inside", () => {
    const report = evaluateArtwork(file(repeat(A5_BLEED, 8), { encrypted: true }), booklet());
    expect(report.checks.map((entry) => entry.id)).toEqual(["size", "pages", "photos"]);
    expect(report.warnings).toBe(true);
  });
});

describe("evaluateArtwork — unreadable files", () => {
  it("blocks a file that couldn't be opened", () => {
    const report = evaluateArtwork({ ok: false, reason: "unreadable" }, booklet());
    expect(report).toMatchObject({ blocking: true, warnings: false });
    expect(report.checks).toHaveLength(1);
    expect(report.checks[0].title).toBe("We couldn’t open your file");
  });
});

describe("printTrim", () => {
  it("is the option's A size for a board, else the product's trim", () => {
    expect(printTrim(BOARD, { label: "A1" })).toEqual({ widthMm: 594, heightMm: 841 });
    expect(printTrim(BOARD, { label: "Poster" })).toEqual(BOARD.trim);
    expect(printTrim(BOARD, { label: "A10" })).toEqual(BOARD.trim);
    expect(printTrim(BOOKLET_FORMAT, { label: "A1" })).toEqual(BOOKLET_FORMAT.trim);
  });

  it("finds the A size in an edited label, then in the slug", () => {
    expect(printTrim(BOARD, { label: "A1 easel" })).toEqual({ widthMm: 594, heightMm: 841 });
    expect(printTrim(BOARD, { label: "Large (a2)" })).toEqual({ widthMm: 420, heightMm: 594 });
    expect(printTrim(BOARD, { id: "board-a3", label: "Large" })).toEqual({ widthMm: 297, heightMm: 420 });
  });
});

describe("parseCanvaUrl", () => {
  it("accepts Canva design and short links, normalised to https", () => {
    expect(parseCanvaUrl("https://www.canva.com/design/DAF123/abc/view")).toBe(
      "https://www.canva.com/design/DAF123/abc/view",
    );
    expect(parseCanvaUrl("  canva.com/design/DAF123/edit ")).toBe("https://canva.com/design/DAF123/edit");
    expect(parseCanvaUrl("http://canva.link/abc123")).toBe("https://canva.link/abc123");
  });

  it("refuses anything that isn't a Canva design", () => {
    expect(parseCanvaUrl("https://www.canva.com/templates/")).toBeNull();
    expect(parseCanvaUrl("https://canva.com.evil.example/design/x")).toBeNull();
    expect(parseCanvaUrl("https://user:pw@www.canva.com/design/x")).toBeNull();
    expect(parseCanvaUrl("javascript:alert(1)")).toBeNull();
    expect(parseCanvaUrl("https://canva.link/")).toBeNull();
    expect(parseCanvaUrl("")).toBeNull();
    expect(parseCanvaUrl(42)).toBeNull();
  });
});

describe("parseServiceDate", () => {
  const now = new Date("2026-10-05T12:00:00Z");

  it("allows a blank date", () => {
    expect(parseServiceDate("", now)).toEqual({ ok: true, date: null });
    expect(parseServiceDate(undefined, now)).toEqual({ ok: true, date: null });
  });

  it("accepts a real date from yesterday to a year ahead", () => {
    expect(parseServiceDate("2026-10-12", now)).toEqual({ ok: true, date: "2026-10-12" });
    expect(parseServiceDate("2026-10-04", now)).toEqual({ ok: true, date: "2026-10-04" });
  });

  it("refuses an impossible, past or distant date", () => {
    expect(parseServiceDate("2026-02-30", now).ok).toBe(false);
    expect(parseServiceDate("12/10/2026", now).ok).toBe(false);
    expect(parseServiceDate("2026-10-01", now)).toEqual({
      ok: false,
      error: "The date of the service has already passed",
    });
    expect(parseServiceDate("2028-01-01", now).ok).toBe(false);
  });
});

describe("previewGroups", () => {
  it("lays a booklet out as it folds: front, openings, back", () => {
    expect(previewGroups(8, 3)).toEqual([
      { label: "Front", pages: [1] },
      { label: "Pages 2–3", pages: [2, 3] },
      { label: "Pages 4–5", pages: [4, 5] },
      { label: "Pages 6–7", pages: [6, 7] },
      { label: "Back", pages: [8] },
    ]);
    expect(previewGroups(4, 3).map((group) => group.label)).toEqual(["Front", "Pages 2–3", "Back"]);
  });

  it("still lays out a booklet with the wrong number of pages", () => {
    expect(previewGroups(7, 3).map((group) => group.label)).toEqual([
      "Front",
      "Pages 2–3",
      "Pages 4–5",
      "Page 6",
      "Back",
    ]);
  });

  it("shows a card's front and back, and a single page on its own", () => {
    expect(previewGroups(2, 2)).toEqual([
      { label: "Front", pages: [1] },
      { label: "Back", pages: [2] },
    ]);
    expect(previewGroups(1, 1)).toEqual([{ label: "Your design", pages: [1] }]);
    expect(previewGroups(1, 2)).toEqual([{ label: "Front", pages: [1] }]);
    expect(previewGroups(0, 3)).toEqual([]);
  });

  it("captions each layout", () => {
    expect(previewCaption(3)).toBe("Shown in the order the pages will be folded");
    expect(previewCaption(2)).toBe("Front and back");
    expect(previewCaption(1)).toBe("");
  });
});

describe("text helpers", () => {
  it("lists pages", () => {
    expect(pagesText([3])).toBe("page 3");
    expect(pagesText([3, 5])).toBe("pages 3 and 5");
    expect(pagesText([2, 4, 6])).toBe("pages 2, 4 and 6");
  });

  it("formats a file size", () => {
    expect(fileSizeText(2.4 * 1024 * 1024)).toBe("2.4 MB");
    expect(fileSizeText(850 * 1024)).toBe("850 KB");
    expect(fileSizeText(10)).toBe("1 KB");
  });
});
