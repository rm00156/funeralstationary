/**
 * Ownership for designs and orders, ahead of a real auth layer.
 *
 * There is no auth provider yet, so a visitor is identified by an opaque
 * `guest_token` cookie. The schema models this as designs.user_id being
 * nullable alongside an indexed designs.guest_token: when accounts land,
 * registration claims a visitor's rows by setting user_id and clearing the
 * token — no data migration required.
 */
import { cookies } from "next/headers";

export const GUEST_COOKIE = "tfs_guest";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export interface Owner {
  /** Always null until an auth provider exists. */
  userId: string | null;
  guestToken: string;
}

/**
 * Read the caller's guest token, minting one if absent.
 *
 * Only callable from a Route Handler or Server Function — setting a cookie
 * during Server Component rendering is not supported. Server Components
 * should use {@link readOwner} instead.
 */
export async function getOrCreateOwner(): Promise<Owner> {
  const jar = await cookies();
  const existing = jar.get(GUEST_COOKIE)?.value;
  if (existing) return { userId: null, guestToken: existing };

  const guestToken = crypto.randomUUID();
  jar.set(GUEST_COOKIE, guestToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
  return { userId: null, guestToken };
}

/** Read-only variant, safe inside Server Components. Null when unvisited. */
export async function readOwner(): Promise<Owner | null> {
  const jar = await cookies();
  const existing = jar.get(GUEST_COOKIE)?.value;
  return existing ? { userId: null, guestToken: existing } : null;
}
