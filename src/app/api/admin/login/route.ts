import type { NextRequest } from "next/server";

import { requestAdminSignInLink } from "@/lib/adminAuth.server";
import { AuthError } from "@/lib/auth.server";
import { isEmailConfigured } from "@/lib/email.server";
import { clientKey, createRateLimiter } from "@/lib/rateLimit";
import { resolveRequestOrigin } from "@/lib/stripe.server";

export const runtime = "nodejs";

/** Each request can send an email, so a script can't hammer it. */
const limiter = createRateLimiter({ limit: 5, windowMs: 15 * 60 * 1000 });

/**
 * POST /api/admin/login { email } — email an admin sign-in link.
 *
 * Answers 200 whether or not the address is an admin: only an admin is sent
 * a link, but the form must not be a way to find out who is one.
 */
export async function POST(request: NextRequest) {
  if (!limiter.hit(clientKey(request.headers))) {
    return Response.json({ error: "Too many attempts — please wait a few minutes and try again." }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { email } = (body ?? {}) as Record<string, unknown>;
  if (typeof email !== "string") {
    return Response.json({ error: "Please enter your email address." }, { status: 400 });
  }
  try {
    await requestAdminSignInLink({ email, origin: resolveRequestOrigin(request) });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Admin sign-in link failed", error);
    return Response.json({ error: "We couldn't send your link just now — please try again." }, { status: 500 });
  }
  // The same for every address: in development without email, any link went to the terminal.
  return Response.json({ ok: true, linkInTerminal: !isEmailConfigured() });
}
