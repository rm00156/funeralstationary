/**
 * The admin session cookie. Admins sign in by emailed one-time link (see
 * adminAuth.server.ts) — this module only mints and reads the cookie that
 * click sets.
 *
 * A signedSession (signedSession.ts) like the customer cookie: an httpOnly
 * cookie holding `${adminId}.${expiresEpochSeconds}.${hmacHex}`, signed with
 * a key derived from AUTH_SECRET under its own label, so a customer token can
 * never pass as an admin one. The cookie only says who the admin *was*:
 * every request also checks the `admins` row still exists (getCurrentAdmin),
 * so removing someone in /admin/access signs them out at once. Rotating
 * AUTH_SECRET signs every admin out too.
 *
 * Unlike the customer cookie, this one never falls back to the public
 * development secret in userSession.ts: the owner's admin id is fixed in
 * migration 0023, so anyone could forge an owner cookie for a dev server
 * reachable from outside (ngrok). Without AUTH_SECRET, development signs
 * with a random secret made once per server process instead — no setup, and
 * a restart just signs you out. In production AUTH_SECRET is required: unset,
 * admin sign-in is off and /admin always redirects to the login page, which
 * says why.
 */
import { randomBytes } from "node:crypto";

import { signedSession } from "@/lib/signedSession";

export const ADMIN_COOKIE = "tfs_admin";
export const ADMIN_SESSION_SECONDS = 60 * 60 * 12;

/** Kept on globalThis so a hot reload doesn't sign the developer out. */
const devSecretStore = globalThis as { __tfsDevAdminSecret?: string };

function adminSecret(): string | null {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "production") return null;
  devSecretStore.__tfsDevAdminSecret ??= randomBytes(32).toString("hex");
  return devSecretStore.__tfsDevAdminSecret;
}

/** Whether admin sign-in can work at all. */
export function adminConfigured(): boolean {
  return adminSecret() !== null;
}

const session = signedSession({ label: "admin", cookie: ADMIN_COOKIE, seconds: ADMIN_SESSION_SECONDS, secret: adminSecret });

/** Mint a session token for an admin, or null when sign-in is not configured. */
export const createAdminToken = session.create;
/** The admin id a token vouches for, or null if it is forged, expired or malformed. */
export const verifyAdminToken = session.verify;
/** The admin id the request's cookie vouches for. Doesn't check the row still exists. */
export const readAdminId = session.read;
/** Route Handlers only — cookies can't be set during render. */
export const setAdminSessionCookie = session.set;
export const clearAdminSessionCookie = session.clear;
