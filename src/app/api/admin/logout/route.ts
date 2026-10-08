import { clearAdminSessionCookie } from "@/lib/adminSession";

export const runtime = "nodejs";

/** POST /api/admin/logout — clear the admin session cookie. */
export async function POST() {
  await clearAdminSessionCookie();
  return Response.json({ ok: true });
}
