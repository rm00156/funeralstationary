/**
 * The customer session cookie — the signed-in half of ownership.
 *
 * Same shape as adminSession.ts: an httpOnly cookie holding
 * `${userId}.${expiresEpochSeconds}.${hmacHex}` keyed off AUTH_SECRET, so
 * there is no session table and nothing to migrate. Rotating AUTH_SECRET
 * signs everyone out, which is the intended revocation lever.
 *
 * Local development needs no setup: without AUTH_SECRET a fixed development
 * secret is used, so sign-in always works on `npm run dev`. In production
 * AUTH_SECRET is required — unset, accounts are off (readUserId() is always
 * null, the sign-in routes answer 503) and the site is guest-only rather
 * than signing cookies with a secret anyone can read in this file.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const USER_COOKIE = "tfs_user";
export const USER_SESSION_SECONDS = 60 * 60 * 24 * 30;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEVELOPMENT_AUTH_SECRET = "tfs-local-development-only";

/** Env is read lazily (never at module scope) so tests can stub it per case. */
function authSecret(): string | null {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  return process.env.NODE_ENV === "production" ? null : DEVELOPMENT_AUTH_SECRET;
}

export function authConfigured(): boolean {
  return authSecret() !== null;
}

function sessionKey(): Buffer | null {
  const secret = authSecret();
  if (!secret) return null;
  return createHash("sha256").update(`tfs-user:${secret}`).digest();
}

function sign(key: Buffer, userId: string, expires: number): Buffer {
  return createHmac("sha256", key).update(`user:${userId}:${expires}`).digest();
}

/** Mint a session token for a user, or null when accounts are not configured. */
export function createUserToken(userId: string, now = Date.now()): string | null {
  const key = sessionKey();
  if (!key || !UUID_RE.test(userId)) return null;
  const expires = Math.floor(now / 1000) + USER_SESSION_SECONDS;
  return `${userId}.${expires}.${sign(key, userId, expires).toString("hex")}`;
}

/** The user id a token vouches for, or null if it is forged, expired or malformed. */
export function verifyUserToken(token: string, now = Date.now()): string | null {
  const key = sessionKey();
  if (!key) return null;
  const [userId, expiresPart, macHex, ...rest] = token.split(".");
  if (rest.length > 0 || !userId || !expiresPart || !macHex) return null;
  if (!UUID_RE.test(userId)) return null;
  const expires = Number(expiresPart);
  if (!Number.isInteger(expires) || expires * 1000 <= now) return null;
  const expected = sign(key, userId, expires);
  const candidate = Buffer.from(macHex, "hex");
  if (candidate.length !== expected.length) return null;
  return timingSafeEqual(candidate, expected) ? userId : null;
}

/** The signed-in user's id from the request cookie, if any. Safe in Server Components. */
export async function readUserId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(USER_COOKIE)?.value;
  return token ? verifyUserToken(token) : null;
}

/** Route Handlers / Server Functions only — cookies can't be set during render. */
export async function setUserSessionCookie(userId: string): Promise<boolean> {
  const token = createUserToken(userId);
  if (!token) return false;
  const jar = await cookies();
  jar.set(USER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: USER_SESSION_SECONDS,
  });
  return true;
}

export async function clearUserSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(USER_COOKIE);
}
