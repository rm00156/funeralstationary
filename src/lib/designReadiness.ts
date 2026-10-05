import type { DesignDoc, DesignPage, ImageElement, TextElement } from "./designEditor";

/**
 * Pre-order checks on a customer's design.
 *
 * The whole point of this module is that a mistake is caught *before* money
 * changes hands, while the customer is still in front of the editor and can
 * fix it themselves — not after payment by a member of staff eyeballing a
 * rendered proof. Two kinds of mistake matter, and they are treated very
 * differently:
 *
 *  - An **empty photo window** is unprintable. The editor draws a dashed
 *    "Double-click to add a photo" box there, and that box is real ink on the
 *    press PDF, so there is no sensible way to print it. Blocking.
 *
 *  - **Text still identical to the template's placeholder** is suspicious but
 *    legitimate — "In loving memory" is what a great many customers actually
 *    want on the cover. Warn, make them look at it, record that they did.
 *
 * Pure and DB-free (same discipline as orders.ts / seedData.ts) so it can be
 * unit-tested and run identically on the client, for a live nudge in the
 * editor, and on the server, where it is actually enforced.
 */

export type ReadinessIssueKind = "empty-photo" | "unchanged-text";

export interface ReadinessIssue {
  kind: ReadinessIssueKind;
  /** 0-based index of the first page the issue appears on. */
  page: number;
  /**
   * How many pages carry this same issue. Interior pages are copies of one
   * authored middle page, so an untouched booklet would otherwise report the
   * same line a dozen times — the dialog shows one row instead.
   */
  occurrences: number;
  /** Every 0-based page the issue appears on, ascending. */
  pages: number[];
  /** Pages in the document, so a location can name the back page. */
  pageCount: number;
  /** The still-default wording, for "unchanged-text". */
  text?: string;
}

export interface DesignReadiness {
  /** Must be fixed before the design can be added to the basket. */
  blocking: ReadinessIssue[];
  /** The customer may proceed, but only after confirming they meant to. */
  warnings: ReadinessIssue[];
}

/** Which of the three authored template pages a document page corresponds to. */
type PageRole = "cover" | "middle" | "back";

function roleOf(index: number, pageCount: number): PageRole {
  if (index === 0) return "cover";
  if (index === pageCount - 1) return "back";
  return "middle";
}

/**
 * Compare-safe form of a text run: leading/trailing space and the exact line
 * breaks a customer may have nudged are not an edit worth crediting, but
 * anything else is.
 */
function normaliseText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

const isText = (element: { type: string }): element is TextElement => element.type === "text";
const isImage = (element: { type: string }): element is ImageElement => element.type === "image";

/**
 * The placeholder wording the template supplies, indexed by page role. A
 * design page is compared only against the template page it was instantiated
 * from, so a customer who moves the cover's wording onto an interior page has
 * still plainly written something.
 *
 * Only text flagged `placeholder` counts — a heading like "Order of Service"
 * is meant to stay, and warning about it buries the one warning that matters
 * (a name nobody changed). A layout with no flags at all predates the flag, so
 * it falls back to every text run until an admin marks it up.
 */
function defaultTextsByRole(pages: DesignPage[]): Record<PageRole, Set<string>> {
  const byRole: Record<PageRole, Set<string>> = {
    cover: new Set(),
    middle: new Set(),
    back: new Set(),
  };
  const texts = pages.flatMap((page, index) =>
    page.elements.filter(isText).map((element) => ({ element, role: roleOf(index, pages.length) })),
  );
  const flagged = texts.some(({ element }) => element.placeholder);
  for (const { element, role } of texts) {
    if (flagged && !element.placeholder) continue;
    const value = normaliseText(element.text);
    if (value) byRole[role].add(value);
  }
  return byRole;
}

/** Collapse per-page hits into one issue per distinct problem, listing its pages. */
function collapse(
  hits: { page: number; text?: string }[],
  kind: ReadinessIssueKind,
  pageCount: number,
): ReadinessIssue[] {
  const byKey = new Map<string, ReadinessIssue>();
  for (const hit of hits) {
    const key = hit.text ? normaliseText(hit.text) : `${kind}:${hit.page}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.occurrences += 1;
      if (!existing.pages.includes(hit.page)) existing.pages.push(hit.page);
      continue;
    }
    byKey.set(key, {
      kind,
      page: hit.page,
      occurrences: 1,
      pages: [hit.page],
      pageCount,
      text: hit.text,
    });
  }
  return [...byKey.values()];
}

/**
 * Check a document against the template it came from.
 *
 * `templatePages` is the template's authored layout (or its starter document
 * when it has none). Pass null when the source is genuinely unknown — an
 * archived template, say — and the unchanged-text warnings are skipped; the
 * blocking photo check never depends on it and always runs.
 */
export function checkDesignReadiness(
  doc: DesignDoc,
  templatePages: DesignPage[] | null,
): DesignReadiness {
  const defaults = templatePages ? defaultTextsByRole(templatePages) : null;
  const emptyPhotos: { page: number }[] = [];
  const unchangedText: { page: number; text: string }[] = [];

  doc.pages.forEach((page, index) => {
    const role = roleOf(index, doc.pages.length);
    for (const element of page.elements) {
      // A locked element is the template's own artwork, not the customer's
      // content — they cannot fix it, so it is never their blocker.
      if (element.locked) continue;
      if (isImage(element) && !element.src) {
        emptyPhotos.push({ page: index });
        continue;
      }
      if (defaults && isText(element)) {
        const value = normaliseText(element.text);
        if (value && defaults[role].has(value)) {
          unchangedText.push({ page: index, text: element.text.trim() });
        }
      }
    }
  });

  return {
    blocking: collapse(emptyPhotos, "empty-photo", doc.pages.length),
    warnings: collapse(unchangedText, "unchanged-text", doc.pages.length),
  };
}

/** True when nothing blocks the design from being ordered. */
export function isDesignOrderable(readiness: DesignReadiness): boolean {
  return readiness.blocking.length === 0;
}

/** True when the customer must actively confirm before the design is added. */
export function needsDefaultsConfirmation(readiness: DesignReadiness): boolean {
  return readiness.warnings.length > 0;
}

function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * Where an issue is, in the customer's terms: "the cover", "the cover and the
 * back page", "pages 2 and 3", "every inside page" — or, on a flat card,
 * "the front" and "the back". Always names the pages
 * rather than a bare count, so the customer knows where to look.
 */
export function issueLocation(issue: ReadinessIssue): string {
  const pages = [...issue.pages].sort((a, b) => a - b);
  const last = issue.pageCount - 1;
  const inside = pages.filter((page) => page !== 0 && page !== last);
  const parts: string[] = [];
  // A flat card or a board has a front and a back, not a cover and a back page.
  const flat = issue.pageCount <= 2;
  if (pages.includes(0)) parts.push(flat ? "the front" : "the cover");
  if (inside.length > 0) {
    const insideCount = issue.pageCount - 2;
    if (inside.length === insideCount && insideCount > 2) parts.push("every inside page");
    else if (inside.length > 3) parts.push(`${inside.length} inside pages`);
    else if (inside.length === 1) parts.push(`page ${inside[0] + 1}`);
    else parts.push(`pages ${joinList(inside.map((page) => String(page + 1)))}`);
  }
  if (last > 0 && pages.includes(last)) parts.push(flat ? "the back" : "the back page");
  return joinList(parts);
}

/** Text in curly quotes, unless it already carries its own. */
export function quoted(text: string): string {
  return /^["'“‘][\s\S]*["'”’]$/.test(text) ? text : `“${text}”`;
}

/** Human-readable one-liner for an issue — shared by the dialog and the API error. */
export function describeIssue(issue: ReadinessIssue): string {
  const where = issueLocation(issue);
  if (issue.kind === "empty-photo") {
    return issue.occurrences > 1
      ? `${issue.occurrences} photo windows are still empty`
      : `A photo window on ${where} is still empty`;
  }
  return `${quoted(issue.text ?? "")} on ${where} is still the template's wording`;
}
