import type { NextRequest } from "next/server";

import { readReviewOptOutToken } from "@/lib/reviewRequest";
import { optOutOfReviewRequests } from "@/lib/reviewRequests.server";
import { resolveRequestOrigin } from "@/lib/stripe.server";
import { authSecret } from "@/lib/userSession";

export const runtime = "nodejs";

/**
 * POST /api/email/unsubscribe?t=… — stops review requests to the address the
 * signed token names. POST only: mail scanners fetch every link in an email,
 * so the link in the email opens a page (/email/unsubscribe) whose button
 * posts here. Mail clients' own unsubscribe button (RFC 8058, the
 * List-Unsubscribe header) posts here directly and gets a bare 200.
 */
export async function POST(request: NextRequest) {
  const secret = authSecret();
  const token = request.nextUrl.searchParams.get("t");
  const email = secret ? readReviewOptOutToken(token, secret) : null;
  if (!email) return Response.json({ error: "This link isn't valid" }, { status: 400 });

  await optOutOfReviewRequests(email);

  const form = await request.formData().catch(() => null);
  if (form?.get("List-Unsubscribe") === "One-Click") return new Response(null, { status: 200 });
  const done = new URL("/email/unsubscribe", resolveRequestOrigin(request));
  done.searchParams.set("t", token!);
  done.searchParams.set("done", "1");
  return Response.redirect(done, 303);
}
