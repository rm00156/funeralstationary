/**
 * The admin session cookie. Admins sign in by emailed one-time link (see
 * adminAuth.server.ts) — this module only mints and reads the cookie that
 * click sets.
 *
 * Same shape as userSession.ts: an httpOnly cookie holding
 * `${adminId}.${expiresEpochSeconds}.${hmacHex}`, signed with a key derived
 * from AUTH_SECRET (its own derivation, so a customer token can never pass as
 * an admin one). The cookie only says who the admin *was*: every request also
 * checks the `admins` row still exists (getCurrentAdmin), so removing someone
 * in /admin/access signs them out at once. Rotating AUTH_SECRET signs every
 * admin out too.
 *
 * Without AUTH_SECRET in production, admin sign-in is off and /admin always
 * redirects to the login page, which says why.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { authSecret } from "@/lib/userSession";

export const ADMIN_COOKIE = "tfs_admin";
export const ADMIN_SESSION_SECONDS = 60 * 60 * 12;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether admin sign-in can work at all. */
export function adminConfigured(): boolean {
  return authSecret() !== null;
}

function sessionKey(): Buffer | null {
  const secret = authSecret();
  if (!secret) return null;
  return createHash("sha256").update(`tfs-admin:${secret}`).digest();
}

function sign(key: Buffer, adminId: string, expires: number): Buffer {
  return createHmac("sha256", key).update(`admin:${adminId}:${expires}`).digest();
}

/** Mint a session token for an admin, or null when sign-in is not configured. */
export function createAdminToken(adminId: string, now = Date.now()): string | null {
  const key = sessionKey();
  if (!key || !UUID_RE.test(adminId)) return null;
  const expires = Math.floor(now / 1000) + ADMIN_SESSION_SECONDS;
  return `${adminId}.${expires}.${sign(key, adminId, expires).toString("hex")}`;
}

/** The admin id a token vouches for, or null if it is forged, expired or malformed. */
export function verifyAdminToken(token: string, now = Date.now()): string | null {
  const key = sessionKey();
  if (!key) return null;
  const [adminId, expiresPart, macHex, ...rest] = token.split(".");
  if (rest.length > 0 || !adminId || !expiresPart || !macHex) return null;
  if (!UUID_RE.test(adminId)) return null;
  const expires = Number(expiresPart);
  if (!Number.isInteger(expires) || expires * 1000 <= now) return null;
  const expected = sign(key, adminId, expires);
  const candidate = Buffer.from(macHex, "hex");
  if (candidate.length !== expected.length) return null;
  return timingSafeEqual(candidate, expected) ? adminId : null;
}

/** The admin id the request's cookie vouches for. Doesn't check the row still exists. */
export async function readAdminId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  return token ? verifyAdminToken(token) : null;
}

/** Route Handlers only — cookies can't be set during render. */
export async function setAdminSessionCookie(adminId: string): Promise<boolean> {
  const token = createAdminToken(adminId);
  if (!token) return false;
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_SECONDS,
  });
  return true;
}

export async function clearAdminSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}
