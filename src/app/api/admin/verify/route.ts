import type { NextRequest } from "next/server";

import { consumeAdminLoginToken } from "@/lib/adminAuth.server";
import { adminConfigured, setAdminSessionCookie } from "@/lib/adminSession";
import { safeNextPath } from "@/lib/auth";

export const runtime = "nodejs";

/** 303, so the browser follows a form POST with a GET. */
const seeOther = (location: string) => new Response(null, { status: 303, headers: { Location: location } });

/**
 * POST /api/admin/verify (form: token) — the "Sign in" button on the page an
 * admin sign-in email links to (/admin/verify).
 *
 * A POST, not the link itself: a mail scanner fetching the link must not
 * spend the single-use token. Only admin tokens are accepted here (a
 * customer's link reads as invalid), and a failed link lands on the login
 * page with the reason.
 */
export async function POST(request: NextRequest) {
  // Before the token is spent, so a link isn't burned on a server that can't
  // sign anyone in. The login page says why.
  if (!adminConfigured()) return seeOther("/admin/login");
  const form = await request.formData().catch(() => null);
  const token = form?.get("token");
  const result = await consumeAdminLoginToken(typeof token === "string" ? token : "");
  if (!result.ok) return seeOther(`/admin/login?error=${result.reason}`);
  if (!(await setAdminSessionCookie(result.adminId))) return seeOther("/admin/login?error=invalid");
  return seeOther(safeNextPath(result.redirectTo, "/admin"));
}
