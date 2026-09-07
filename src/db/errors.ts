/** True when `error`, or anything it wraps, is the given MySQL error. */
function isMysqlError(error: unknown, code: string, errno: number): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    const candidate = current as { code?: unknown; errno?: unknown; cause?: unknown };
    if (candidate.code === code || candidate.errno === errno) return true;
    current = candidate.cause;
  }
  return false;
}

/** True for the MySQL duplicate-key error a unique-column collision raises. */
export function isDuplicateKeyError(error: unknown): boolean {
  return isMysqlError(error, "ER_DUP_ENTRY", 1062);
}

/**
 * True for the error a DELETE raises when another table's ON DELETE RESTRICT
 * foreign key still points at the row — the backstop for adminDeleteTemplate's
 * up-front usage check losing a race with a design being created.
 */
export function isRowReferencedError(error: unknown): boolean {
  return isMysqlError(error, "ER_ROW_IS_REFERENCED_2", 1451);
}
