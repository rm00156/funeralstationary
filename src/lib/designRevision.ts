/**
 * The revision guard on design saves (see designs.revision): an editor sends
 * the revision it loaded, and a save from an out-of-date copy is refused with
 * a 409 `{ reason: "conflict" }` instead of overwriting the newer design.
 */

/** The 409 body a refused save carries. */
export const DESIGN_CONFLICT_REASON = "conflict";

/**
 * A save's `revision` field: undefined when absent (a tab opened before
 * revisions existed saves unconditionally), the number when it is a
 * non-negative integer, and "invalid" otherwise.
 */
export function parseExpectedRevision(value: unknown): number | undefined | "invalid" {
  if (value === undefined || value === null) return undefined;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : "invalid";
}

/** Whether a failed save's response body is the revision guard's refusal. */
export function isDesignConflict(status: number, body: unknown): boolean {
  return (
    status === 409 &&
    !!body &&
    typeof body === "object" &&
    (body as { reason?: unknown }).reason === DESIGN_CONFLICT_REASON
  );
}

/**
 * Runs tasks one at a time, in the order they were queued — each starts once
 * the one before has settled, whether it succeeded or not. The editor queues
 * its saves on one: two in flight would carry the same revision, so the
 * second would be refused as a clash (and before the row exists, both would
 * create one).
 */
export function createSerialQueue(): <T>(task: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return (task) => {
    const run = tail.then(task, task);
    tail = run.catch(() => undefined);
    return run;
  };
}

/**
 * Whether a save changes what the design looks like — its pages, page count
 * and paper, or template — and so takes and checks a revision. A rename alone
 * doesn't: a name is just the customer's label for the design.
 */
export function changesContent(patch: {
  doc?: unknown;
  spec?: unknown;
  templateId?: unknown;
}): boolean {
  return patch.doc !== undefined || patch.spec !== undefined || patch.templateId !== undefined;
}
