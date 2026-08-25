import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/adminSession";

export const runtime = "nodejs";

/** POST /api/admin/logout — clear the admin session cookie. */
export async function POST() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  return Response.json({ ok: true });
}
