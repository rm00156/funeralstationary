import type { NextRequest } from "next/server";

import { AdminAccessError, getCurrentAdmin, grantAdminAccess, unauthorised } from "@/lib/adminAuth.server";
import { resolveRequestOrigin } from "@/lib/stripe.server";

export const runtime = "nodejs";

/**
 * POST /api/admin/access { email } — give an address admin access and email
 * it an invitation. Answers with how the invitation went, so the page can say
 * when it has to be passed on by hand.
 */
export async function POST(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorised();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { email } = (body ?? {}) as Record<string, unknown>;
  if (typeof email !== "string") {
    return Response.json({ error: "Please enter an email address." }, { status: 400 });
  }
  try {
    const result = await grantAdminAccess({ email, grantedBy: admin, origin: resolveRequestOrigin(request) });
    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
