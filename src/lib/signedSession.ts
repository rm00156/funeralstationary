/**
 * The stateless session cookie both sign-ins use: an httpOnly cookie holding
 * `${id}.${expiresEpochSeconds}.${hmacHex}`, so there is no session table.
 * userSession.ts and adminSession.ts each make one with their own label —
 * the label goes into both the key derivation and the signed message, so a
 * customer token can never pass as an admin one — and their own secret.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SignedSession {
  /** Mint a token for an id, or null when there is no secret (or the id isn't a UUID). */
  create(id: string, now?: number): string | null;
  /** The id a token vouches for, or null if it is forged, expired or malformed. */
  verify(token: string, now?: number): string | null;
  /** The id the request's cookie vouches for. Safe in Server Components. */
  read(): Promise<string | null>;
  /** Route Handlers / Server Functions only — cookies can't be set during render. */
  set(id: string): Promise<boolean>;
  clear(): Promise<void>;
}

export function signedSession(options: {
  /** "user" or "admin" — keys and messages are domain-separated by it. */
  label: string;
  cookie: string;
  seconds: number;
  /** Read on every call (never at module scope) so tests can stub env per case. */
  secret: () => string | null;
}): SignedSession {
  const { label, cookie, seconds } = options;

  const key = (): Buffer | null => {
    const secret = options.secret();
    return secret ? createHash("sha256").update(`tfs-${label}:${secret}`).digest() : null;
  };
  const sign = (k: Buffer, id: string, expires: number) =>
    createHmac("sha256", k).update(`${label}:${id}:${expires}`).digest();

  const create = (id: string, now = Date.now()): string | null => {
    const k = key();
    if (!k || !UUID_RE.test(id)) return null;
    const expires = Math.floor(now / 1000) + seconds;
    return `${id}.${expires}.${sign(k, id, expires).toString("hex")}`;
  };

  const verify = (token: string, now = Date.now()): string | null => {
    const k = key();
    if (!k) return null;
    const [id, expiresPart, macHex, ...rest] = token.split(".");
    if (rest.length > 0 || !id || !expiresPart || !macHex) return null;
    if (!UUID_RE.test(id)) return null;
    const expires = Number(expiresPart);
    if (!Number.isInteger(expires) || expires * 1000 <= now) return null;
    const expected = sign(k, id, expires);
    const candidate = Buffer.from(macHex, "hex");
    if (candidate.length !== expected.length) return null;
    return timingSafeEqual(candidate, expected) ? id : null;
  };

  return {
    create,
    verify,
    async read() {
      const token = (await cookies()).get(cookie)?.value;
      return token ? verify(token) : null;
    },
    async set(id) {
      const token = create(id);
      if (!token) return false;
      (await cookies()).set(cookie, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: seconds,
      });
      return true;
    },
    async clear() {
      (await cookies()).delete(cookie);
    },
  };
}
