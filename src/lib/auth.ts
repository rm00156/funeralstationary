/**
 * Pure helpers for email sign-in — no DB, no cookies, unit-tested.
 * The stateful half (token rows, claiming, sessions) is auth.server.ts.
 */
import { createHash, randomBytes } from "node:crypto";

/** How long an emailed sign-in link stays valid. */
export const LOGIN_LINK_TTL_SECONDS = 60 * 15;

/** Case- and whitespace-insensitive: `Jo@Example.com ` is the same account as `jo@example.com`. */
export function normaliseEmail(input: string): string {
  return input.trim().toLowerCase();
}

/** Loose shape check — the emailed link is the real proof the address works. */
export function isValidEmail(email: string): boolean {
  return email.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Only a site-relative path may be a post-sign-in destination, so a crafted
 * link can never bounce a signed-in visitor off to another site. Anything
 * else falls back to the account page.
 */
export function safeNextPath(candidate: unknown, fallback = "/account"): string {
  if (typeof candidate !== "string") return fallback;
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.startsWith("/\\")) {
    return fallback;
  }
  if (/[\r\n]/.test(candidate) || candidate.length > 512) return fallback;
  return candidate;
}

/** The secret that goes in the email: 32 random bytes, URL-safe. */
export function generateLoginSecret(): string {
  return randomBytes(32).toString("base64url");
}

/** What the database stores instead of the secret. */
export function hashLoginSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function loginLinkUrl(origin: string, secret: string): string {
  return `${origin}/api/auth/verify?token=${encodeURIComponent(secret)}`;
}

/** An admin's sign-in link — its own route, which spends only admin tokens. */
export function adminLoginLinkUrl(origin: string, secret: string): string {
  return `${origin}/api/admin/verify?token=${encodeURIComponent(secret)}`;
}

/** The admin sign-in page with the address filled in — what an invitation links to. */
export function adminSignInPageUrl(origin: string, email: string): string {
  return `${origin}/admin/login?email=${encodeURIComponent(email)}`;
}
