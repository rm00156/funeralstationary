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
   * same line a dozen times — the dialog shows one row and a count instead.
   */
  occurrences: number;
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
 */
function defaultTextsByRole(pages: DesignPage[]): Record<PageRole, Set<string>> {
  const byRole: Record<PageRole, Set<string>> = {
    cover: new Set(),
    middle: new Set(),
    back: new Set(),
  };
  pages.forEach((page, index) => {
    const role = roleOf(index, pages.length);
    for (const element of page.elements) {
      if (!isText(element)) continue;
      const value = normaliseText(element.text);
      if (value) byRole[role].add(value);
    }
  });
  return byRole;
}

/** Collapse per-page hits into one issue carrying the first page and a count. */
function collapse(
  hits: { page: number; text?: string }[],
  kind: ReadinessIssueKind,
): ReadinessIssue[] {
  const byKey = new Map<string, ReadinessIssue>();
  for (const hit of hits) {
    const key = hit.text ? normaliseText(hit.text) : `${kind}:${hit.page}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.occurrences += 1;
      continue;
    }
    byKey.set(key, { kind, page: hit.page, occurrences: 1, text: hit.text });
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
    blocking: collapse(emptyPhotos, "empty-photo"),
    warnings: collapse(unchangedText, "unchanged-text"),
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

/** Where an issue is, in the customer's terms — "the cover", "4 pages". */
export function issueLocation(issue: ReadinessIssue): string {
  if (issue.occurrences > 1) return `${issue.occurrences} pages`;
  return issue.page === 0 ? "the cover" : `page ${issue.page + 1}`;
}

/** Human-readable one-liner for an issue — shared by the dialog and the API error. */
export function describeIssue(issue: ReadinessIssue): string {
  const where = issueLocation(issue);
  if (issue.kind === "empty-photo") {
    return issue.occurrences > 1
      ? `${issue.occurrences} photo windows are still empty`
      : `A photo window on ${where} is still empty`;
  }
  return `“${issue.text ?? ""}” on ${where} is still the template's wording`;
}
