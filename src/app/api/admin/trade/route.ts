import type { NextRequest } from "next/server";

import { isAdmin, unauthorised } from "@/lib/adminAuth.server";
import { parseTradeFirmInput } from "@/lib/trade";
import { createTradeFirm } from "@/lib/trade.server";

export const runtime = "nodejs";

/** POST /api/admin/trade { name, paymentTermsDays } — set up a trade firm. Answers its id. */
export async function POST(request: NextRequest) {
  if (!(await isAdmin())) return unauthorised();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = parseTradeFirmInput(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const id = await createTradeFirm(parsed.value);
  return Response.json({ id }, { status: 201 });
}
