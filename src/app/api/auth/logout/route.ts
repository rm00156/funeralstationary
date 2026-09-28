import { clearUserSessionCookie } from "@/lib/userSession";

export const runtime = "nodejs";

/**
 * POST /api/auth/logout — clear the customer session. The guest cookie is
 * left alone: everything it owned was claimed at sign-in, so the browser
 * simply goes back to being an empty guest.
 */
export async function POST() {
  await clearUserSessionCookie();
  return Response.json({ ok: true });
}
