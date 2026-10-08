import type { NextRequest } from "next/server";

import { addUploadCartItem, cartErrorResponse } from "@/lib/orders.server";
import { getOrCreateOwner } from "@/lib/session";
import { uploadErrorResponse } from "@/lib/uploads.server";
import { isShopOpen, shopClosedResponse } from "@/lib/siteBilling.server";

export const runtime = "nodejs";
/** Usually instant, but reads the file if it has never been checked. */
export const maxDuration = 60;

const optionalSlug = (value: unknown): string | undefined =>
  typeof value === "string" && value ? value : undefined;

/**
 * POST /api/cart/uploads — add the customer's own artwork to the basket (the
 * upload flow's "Add to basket"). Idempotent per upload.
 *
 * The file check is the gate, re-run here: a blocking fault is a 409 with
 * `reason: "blocked"`, and unaccepted warnings a 409 with `reason: "confirm"`
 * until `acceptWarnings` says the customer chose "Print it as it is". Both
 * carry the `report`. `confirmed` is the "I've checked the names, dates and
 * spelling" tick, which is required.
 */
export async function POST(request: NextRequest) {
  if (!(await isShopOpen())) return shopClosedResponse();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { uploadId, product, pages, paper, quantity, delivery, serviceDate, confirmed, acceptWarnings } =
    (body ?? {}) as Record<string, unknown>;
  if (typeof uploadId !== "string" || !uploadId) {
    return Response.json({ error: "uploadId is required" }, { status: 400 });
  }

  const owner = await getOrCreateOwner();
  try {
    const cart = await addUploadCartItem(owner, {
      uploadId,
      product,
      pages,
      paper: optionalSlug(paper),
      quantity: optionalSlug(quantity),
      delivery: optionalSlug(delivery),
      serviceDate,
      confirmed: confirmed === true,
      acceptWarnings: acceptWarnings === true,
    });
    return Response.json({ cart }, { status: 201 });
  } catch (error) {
    const response = cartErrorResponse(error) ?? uploadErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
