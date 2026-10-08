import type { NextRequest } from "next/server";
import { redirect } from "next/navigation";

import { consumeAdminLoginToken } from "@/lib/adminAuth.server";
import { setAdminSessionCookie } from "@/lib/adminSession";
import { safeNextPath } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/admin/verify?token=… — the link from an admin sign-in email.
 *
 * A Route Handler, not a page: spending the token and setting the cookie are
 * side effects. Only admin tokens are accepted here (a customer's link reads
 * as invalid), and a failed link lands on the login page with the reason.
 */
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("token") ?? "";
  const result = await consumeAdminLoginToken(secret);
  if (!result.ok) redirect(`/admin/login?error=${result.reason}`);
  if (!(await setAdminSessionCookie(result.adminId))) redirect("/admin/login?error=invalid");
  redirect(safeNextPath(result.redirectTo, "/admin"));
}
