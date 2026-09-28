import type { NextRequest } from "next/server";

import { AuthError, requestSignInLink } from "@/lib/auth.server";
import { resolveRequestOrigin } from "@/lib/stripe.server";

export const runtime = "nodejs";

/**
 * POST /api/auth/login { email, next? } — email a one-time sign-in link.
 *
 * Answers 200 whether or not the address is known: the form must not be a
 * way to find out who has an account here.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { email, next } = (body ?? {}) as Record<string, unknown>;
  if (typeof email !== "string") {
    return Response.json({ error: "Please enter your email address." }, { status: 400 });
  }
  let developmentLink: string | null;
  try {
    ({ developmentLink } = await requestSignInLink({
      email,
      next: typeof next === "string" ? next : undefined,
      origin: resolveRequestOrigin(request),
    }));
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Sign-in link failed", error);
    return Response.json(
      { error: "We couldn't send your link just now — please try again." },
      { status: 500 },
    );
  }
  // Only ever non-null in development without email set up — see requestSignInLink.
  return Response.json({ ok: true, developmentLink });
}
