import type { NextRequest } from "next/server";

import { renderOrigin } from "@/lib/headlessBrowser.server";
import { newestPrintPdfUrl } from "@/lib/orderFulfilment.server";
import { isStorageConfigured } from "@/lib/storage";
import { verifyPressFileSignature } from "@/lib/thintent";

export const runtime = "nodejs";
// Headless Chromium on a first open — same budget as /api/proof.
export const maxDuration = 60;

/**
 * GET /api/thintent/press/:orderId/:itemId?sig=… — the "Print PDF" link on a
 * Thintent job (pressFileUrl). Redirects to the line's newest print PDF,
 * rendering it on the first open. No admin login: the signature is the
 * permission, since the shop opens it from Thintent, not from here.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/thintent/press/[orderId]/[itemId]">,
) {
  const { orderId, itemId } = await ctx.params;
  const key = process.env.THINTENT_API_KEY;
  if (!key || !verifyPressFileSignature(orderId, itemId, request.nextUrl.searchParams.get("sig"), key)) {
    return new Response("This link isn't valid.", { status: 403 });
  }
  if (!isStorageConfigured()) {
    return new Response("Object storage is not configured — the print PDF can't be stored.", { status: 503 });
  }

  const pdfUrl = await newestPrintPdfUrl(orderId, itemId, renderOrigin(request));
  if (!pdfUrl) {
    return new Response("There's no proof for this line yet — make one on the website's order page.", {
      status: 404,
    });
  }
  // Not cached: a corrected proof changes where this goes.
  return new Response(null, { status: 302, headers: { Location: pdfUrl, "Cache-Control": "no-store" } });
}
