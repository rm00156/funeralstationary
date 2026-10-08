/**
 * The customer session cookie — the signed-in half of ownership.
 *
 * A signedSession (signedSession.ts): an httpOnly cookie holding
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
import { signedSession } from "@/lib/signedSession";

export const USER_COOKIE = "tfs_user";
export const USER_SESSION_SECONDS = 60 * 60 * 24 * 30;

const DEVELOPMENT_AUTH_SECRET = "tfs-local-development-only";

/**
 * The secret customer session cookies are signed with. Env is read lazily
 * (never at module scope) so tests can stub it per case. The admin cookie
 * derives its own key from AUTH_SECRET too, but never falls back to this
 * public development secret — see adminSession.ts.
 */
export function authSecret(): string | null {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  return process.env.NODE_ENV === "production" ? null : DEVELOPMENT_AUTH_SECRET;
}

export function authConfigured(): boolean {
  return authSecret() !== null;
}

const session = signedSession({ label: "user", cookie: USER_COOKIE, seconds: USER_SESSION_SECONDS, secret: authSecret });

/** Mint a session token for a user, or null when accounts are not configured. */
export const createUserToken = session.create;
/** The user id a token vouches for, or null if it is forged, expired or malformed. */
export const verifyUserToken = session.verify;
/** The signed-in user's id from the request cookie, if any. Safe in Server Components. */
export const readUserId = session.read;
/** Route Handlers / Server Functions only — cookies can't be set during render. */
export const setUserSessionCookie = session.set;
export const clearUserSessionCookie = session.clear;
