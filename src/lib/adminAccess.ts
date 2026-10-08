/**
 * Who may manage admin access — pure, no DB, unit-tested. The stateful half
 * (the `admins` rows, links, the session) is adminAuth.server.ts.
 */

export interface AdminAccount {
  id: string;
  email: string;
  isOwner: boolean;
  addedBy: string | null;
  lastSignInAt: Date | null;
  createdAt: Date;
}

/**
 * Why `actorEmail` can't remove `target`, or null if they can. The owner is
 * never removable, so there is always someone able to sign in; nobody removes
 * themselves, so a slip can't lock the person at the keyboard out mid-task.
 */
export function removeAdminRefusal(
  target: Pick<AdminAccount, "email" | "isOwner">,
  actorEmail: string,
): string | null {
  if (target.isOwner) return "The owner's access can't be removed.";
  if (target.email === actorEmail) return "You can't remove your own access — ask another admin.";
  return null;
}

/** The owner first, then everyone else in the order they were added. */
export function sortAdmins<T extends Pick<AdminAccount, "isOwner" | "createdAt">>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => Number(b.isOwner) - Number(a.isOwner) || a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

/** Why a sign-in link didn't work, from /api/admin/verify. */
const LINK_ERRORS: Record<string, string> = {
  expired: "That sign-in link has expired. Ask for a new one below.",
  used: "That sign-in link has already been used. Ask for a new one below.",
  invalid: "That sign-in link isn't valid. Ask for a new one below.",
  revoked: "That email address no longer has admin access.",
};

/**
 * The login page's message for its `?error=` param, or null for none. The
 * param is untrusted, so it is looked up with hasOwn: `?error=__proto__`
 * would otherwise read Object.prototype and crash the render.
 */
export function adminLinkError(param: unknown): string | null {
  if (typeof param !== "string" || !param) return null;
  return Object.hasOwn(LINK_ERRORS, param) ? LINK_ERRORS[param] : LINK_ERRORS.invalid;
}
