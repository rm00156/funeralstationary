/**
 * Shared-secret admin authentication — deliberately minimal, no packages.
 *
 * A single ADMIN_PASSWORD env var gates /admin. A successful login sets an
 * httpOnly cookie holding `${expiresEpochSeconds}.${hmacHex}` where the HMAC
 * is keyed off ADMIN_SESSION_SECRET (or, when unset, a digest derived from
 * the password itself) — no session table, nothing to migrate. When real
 * accounts land, swap the internals of this module and nothing else moves.
 *
 * The security boundary is per-request: the protected admin layout calls
 * requireAdmin() for UX, and every /api/admin/* handler independently checks
 * isAdmin() before mutating anything (a layout check alone can be bypassed).
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const ADMIN_COOKIE = "tfs_admin";
export const ADMIN_SESSION_SECONDS = 60 * 60 * 12;

/** Whether admin login is enabled at all. */
export function adminConfigured(): boolean {
  return !!process.env.ADMIN_PASSWORD;
}

/** Env is read lazily (never at module scope) so tests can stub it per case. */
function sessionKey(): Buffer | null {
  const secret =
    process.env.ADMIN_SESSION_SECRET ??
    (process.env.ADMIN_PASSWORD ? `tfs-admin:${process.env.ADMIN_PASSWORD}` : null);
  if (!secret) return null;
  return createHash("sha256").update(secret).digest();
}

/** Mint a session token, or null when admin is not configured. */
export function createAdminToken(now = Date.now()): string | null {
  const key = sessionKey();
  if (!key) return null;
  const expires = Math.floor(now / 1000) + ADMIN_SESSION_SECONDS;
  const mac = createHmac("sha256", key).update(`admin:${expires}`).digest("hex");
  return `${expires}.${mac}`;
}

export function verifyAdminToken(token: string, now = Date.now()): boolean {
  const key = sessionKey();
  if (!key) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const expires = Number(token.slice(0, dot));
  if (!Number.isInteger(expires) || expires * 1000 <= now) return false;
  const expected = createHmac("sha256", key).update(`admin:${expires}`).digest();
  const candidate = Buffer.from(token.slice(dot + 1), "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

/** Timing-safe password comparison (digests first, so lengths always match). */
export function passwordMatches(candidate: string): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  return timingSafeEqual(
    createHash("sha256").update(candidate).digest(),
    createHash("sha256").update(password).digest(),
  );
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  return token ? verifyAdminToken(token) : false;
}

/** For pages/layouts — bounce anonymous visitors to the login form. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}

/** For /api/admin/* handlers. */
export function unauthorised(): Response {
  return Response.json({ error: "Unauthorised" }, { status: 401 });
}
