/**
 * Ownership for designs and orders.
 *
 * A visitor is one of two things: a signed-in customer (a `tfs_user` cookie
 * vouching for a users row — see userSession.ts) or a guest identified by an
 * opaque `tfs_guest` cookie. Both are an Owner; every owner-scoped query in
 * designs.server.ts / orders.server.ts switches on which half is set.
 *
 * A guest becomes a customer by proving an email address (auth.server.ts),
 * at which point the rows under their guest token are claimed — user_id set,
 * guest_token cleared. No data migration; the schema always had both
 * columns for exactly this.
 */
import { cookies } from "next/headers";
import { readUserId } from "@/lib/userSession";

export const GUEST_COOKIE = "tfs_guest";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export type Owner =
  | {
      /** A signed-in customer. Rows are scoped by user_id. */
      userId: string;
      /** The guest cookie, if this browser has one — kept so a sign-in can claim its rows. */
      guestToken: string | null;
    }
  | {
      /** A guest. Rows are scoped by guest_token. */
      userId: null;
      guestToken: string;
    };

/** A stable per-owner key for storage paths. */
export function ownerKey(owner: Owner): string {
  return owner.userId ?? owner.guestToken;
}

/**
 * Read the caller's identity, minting a guest token if there is none.
 *
 * Only callable from a Route Handler or Server Function — setting a cookie
 * during Server Component rendering is not supported. Server Components
 * should use {@link readOwner} instead.
 */
export async function getOrCreateOwner(): Promise<Owner> {
  const jar = await cookies();
  const existing = jar.get(GUEST_COOKIE)?.value ?? null;
  const userId = await readUserId();
  if (userId) return { userId, guestToken: existing };
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
  const existing = jar.get(GUEST_COOKIE)?.value ?? null;
  const userId = await readUserId();
  if (userId) return { userId, guestToken: existing };
  return existing ? { userId: null, guestToken: existing } : null;
}
