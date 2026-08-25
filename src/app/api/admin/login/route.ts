import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_SECONDS,
  adminConfigured,
  createAdminToken,
  passwordMatches,
} from "@/lib/adminSession";

export const runtime = "nodejs";

/** POST /api/admin/login — exchange the shared password for a session cookie. */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { password } = (body ?? {}) as Record<string, unknown>;

  if (!adminConfigured()) {
    return Response.json({ error: "Admin is not configured" }, { status: 503 });
  }
  if (typeof password !== "string" || !passwordMatches(password)) {
    return Response.json({ error: "Incorrect password" }, { status: 401 });
  }

  const token = createAdminToken();
  if (!token) {
    return Response.json({ error: "Admin is not configured" }, { status: 503 });
  }
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_SECONDS,
  });
  return Response.json({ ok: true });
}
