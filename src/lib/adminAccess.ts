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
