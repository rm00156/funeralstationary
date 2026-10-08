/**
 * Admin sign-in and access — the stateful half of adminAccess.ts.
 *
 * Admins sign in the way customers do, by emailed one-time link, but only an
 * address listed in `admins` is ever sent one, and the link (a `login_tokens`
 * row with purpose "admin") is spent by its own route and sets its own
 * cookie (adminSession.ts). The login form answers the same for every
 * address, so it can't be used to find out who is an admin.
 *
 * The security boundary is per request: the protected admin layout calls
 * requireAdmin() for UX, and every /api/admin/* handler independently checks
 * isAdmin() before doing anything. Both read the `admins` row behind the
 * cookie, so removing someone in /admin/access locks them out at once.
 */
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { cache } from "react";

import { db } from "@/db";
import { isDuplicateKeyError } from "@/db/errors";
import { admins } from "@/db/schema";
import { removeAdminRefusal, sortAdmins, type AdminAccount } from "@/lib/adminAccess";
import { adminConfigured, readAdminId } from "@/lib/adminSession";
import { adminSignInPageUrl, isValidEmail, normaliseEmail } from "@/lib/auth";
import { AuthError, createLoginLink, spendLoginToken } from "@/lib/auth.server";
import { isEmailConfigured, sendEmail } from "@/lib/email.server";
import { adminInviteEmail, adminSignInEmail } from "@/lib/orderEmails";

export interface CurrentAdmin {
  id: string;
  email: string;
  isOwner: boolean;
}

/**
 * The signed-in admin, or null. React-cached per request so the layout and
 * the page share one lookup. A cookie naming a removed admin reads as
 * signed out.
 */
export const getCurrentAdmin = cache(async (): Promise<CurrentAdmin | null> => {
  const adminId = await readAdminId();
  if (!adminId) return null;
  const [row] = await db
    .select({ id: admins.id, email: admins.email, isOwner: admins.isOwner })
    .from(admins)
    .where(eq(admins.id, adminId))
    .limit(1);
  return row ?? null;
});

export async function isAdmin(): Promise<boolean> {
  return (await getCurrentAdmin()) !== null;
}

/** For pages/layouts — bounce anyone not signed in as an admin to the login form. */
export async function requireAdmin(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

/** For /api/admin/* handlers. */
export function unauthorised(): Response {
  return Response.json({ error: "Unauthorised" }, { status: 401 });
}

/**
 * Email a sign-in link if the address is an admin; do nothing otherwise.
 * Either way the caller answers the same — and as fast: the link is made and
 * sent after the response, so neither the timing nor a failed send can tell
 * an admin's address from a stranger's. Development without email prints
 * the link in the server's terminal only, never on screen, so a dev server
 * reachable from outside doesn't hand an admin link to whoever types an
 * admin's address.
 */
export async function requestAdminSignInLink(input: { email: string; origin: string }): Promise<void> {
  if (!adminConfigured()) {
    throw new AuthError("Admin sign-in is not configured — set AUTH_SECRET (see .env.example).", 503);
  }
  const email = normaliseEmail(input.email);
  if (!isValidEmail(email)) throw new AuthError("Please enter a valid email address.", 400);
  // Checked before the lookup, so a missing mail provider can't tell admins
  // and strangers apart by which of them gets the 503.
  if (!isEmailConfigured() && process.env.NODE_ENV === "production") {
    throw new AuthError("Email is not configured, so we can't send a sign-in link right now.", 503);
  }

  const [admin] = await db.select({ id: admins.id }).from(admins).where(eq(admins.email, email)).limit(1);
  if (!admin) return;

  after(async () => {
    try {
      const link = await createLoginLink({ email, origin: input.origin, next: "/admin", purpose: "admin" });
      if (isEmailConfigured()) {
        await sendEmail({ to: link.email, ...adminSignInEmail(link.url) });
      } else {
        console.info(`[admin] Email is not configured. Admin sign-in link for ${link.email}:\n  ${link.url}`);
      }
    } catch (error) {
      console.error("Admin sign-in link failed", error);
    }
  });
}

export type AdminSignInResult =
  | { ok: true; adminId: string; redirectTo: string }
  | { ok: false; reason: "invalid" | "expired" | "used" | "revoked" };

/**
 * Spend an admin link. Access is checked again at the click, not just at the
 * request: someone removed in the 15 minutes between gets "revoked".
 */
export async function consumeAdminLoginToken(secret: string): Promise<AdminSignInResult> {
  const spent = await spendLoginToken(secret, "admin");
  if (!spent.ok) return spent;
  const [admin] = await db.select({ id: admins.id }).from(admins).where(eq(admins.email, spent.email)).limit(1);
  if (!admin) return { ok: false, reason: "revoked" };
  await db.update(admins).set({ lastSignInAt: new Date() }).where(eq(admins.id, admin.id));
  return { ok: true, adminId: admin.id, redirectTo: spent.redirectTo };
}

export async function listAdmins(): Promise<AdminAccount[]> {
  const rows = await db
    .select({
      id: admins.id,
      email: admins.email,
      isOwner: admins.isOwner,
      addedBy: admins.addedBy,
      lastSignInAt: admins.lastSignInAt,
      createdAt: admins.createdAt,
    })
    .from(admins);
  return sortAdmins(rows);
}

/** A refused access change the route maps straight to a status code. */
export class AdminAccessError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409,
  ) {
    super(message);
    this.name = "AdminAccessError";
  }
}

export type InviteDelivery = "sent" | "failed" | "not-configured";

/**
 * Give an address admin access and email it an invitation to sign in. The
 * access stands even if the email fails — the admin is told, and can pass on
 * the sign-in page themselves.
 */
export async function grantAdminAccess(input: {
  email: string;
  grantedBy: CurrentAdmin;
  origin: string;
}): Promise<{ email: string; invite: InviteDelivery; signInPageUrl: string }> {
  const email = normaliseEmail(input.email);
  if (!isValidEmail(email)) throw new AdminAccessError("Please enter a valid email address.", 400);
  try {
    await db.insert(admins).values({ id: crypto.randomUUID(), email, addedBy: input.grantedBy.email });
  } catch (error) {
    if (isDuplicateKeyError(error)) throw new AdminAccessError(`${email} already has admin access.`, 409);
    throw error;
  }

  const signInPageUrl = adminSignInPageUrl(input.origin, email);
  if (!isEmailConfigured()) return { email, invite: "not-configured", signInPageUrl };
  try {
    await sendEmail({ to: email, ...adminInviteEmail({ signInPageUrl, invitedBy: input.grantedBy.email }) });
    return { email, invite: "sent", signInPageUrl };
  } catch (error) {
    console.error("Admin invitation email failed", error);
    return { email, invite: "failed", signInPageUrl };
  }
}

/** Remove someone's admin access. The owner's row is never deleted. */
export async function removeAdminAccess(adminId: string, actor: CurrentAdmin): Promise<void> {
  const [target] = await db
    .select({ email: admins.email, isOwner: admins.isOwner })
    .from(admins)
    .where(eq(admins.id, adminId))
    .limit(1);
  if (!target) throw new AdminAccessError("That admin no longer exists.", 404);
  const refusal = removeAdminRefusal(target, actor.email);
  if (refusal) throw new AdminAccessError(refusal, 409);
  // The owner guard is in the WHERE too, so the rule holds whatever the check above says.
  await db.delete(admins).where(and(eq(admins.id, adminId), eq(admins.isOwner, false)));
}
