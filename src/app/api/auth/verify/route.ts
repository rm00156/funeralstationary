import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { claimOwnership, consumeLoginToken } from "@/lib/auth.server";
import { GUEST_COOKIE } from "@/lib/session";
import { setUserSessionCookie } from "@/lib/userSession";

export const runtime = "nodejs";

/**
 * GET /api/auth/verify?token=… — the link from the email.
 *
 * A Route Handler, not a page: it spends the token, sets the session cookie
 * and claims rows, all side effects. The destination comes from the token
 * row, never the URL. A failed link lands on the account page with the
 * reason, where a fresh one can be requested.
 */
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("token") ?? "";
  const result = await consumeLoginToken(secret);
  if (!result.ok) redirect(`/account?error=${result.reason}`);

  const jar = await cookies();
  const guestToken = jar.get(GUEST_COOKIE)?.value ?? null;
  const set = await setUserSessionCookie(result.userId);
  if (!set) redirect("/account?error=invalid");
  await claimOwnership({ userId: result.userId, email: result.email, guestToken });
  redirect(result.redirectTo);
}
