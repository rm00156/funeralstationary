import { after, type NextRequest } from "next/server";

import { sendOrderCancelledEmails } from "@/lib/orderFulfilment.server";
import { resolveRequestOrigin } from "@/lib/stripe.server";
import { parseThintentJobEvent, verifyThintentSignature } from "@/lib/thintent";
import { applyThintentJobEvent } from "@/lib/thintent.server";

export const runtime = "nodejs";

/**
 * POST /api/thintent/webhook — Thintent telling us a job moved (dispatched
 * with its tracking, completed, cancelled, ...). The body is read raw for
 * the signature.
 * Like the Stripe webhook, anything we can't act on — an event we don't
 * handle, an order number we don't know — is answered 200 so Thintent stops
 * retrying it; only a bad signature is refused. Applying an event is
 * idempotent, so a redelivery is harmless.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.THINTENT_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "Thintent webhooks are not configured" }, { status: 503 });

  const rawBody = await request.text();
  if (!verifyThintentSignature(request.headers.get("thintent-signature"), rawBody, secret)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ received: true });
  }
  const event = parseThintentJobEvent(body);
  if (!event) return Response.json({ received: true });

  const outcome = await applyThintentJobEvent(event);
  if (outcome.result === "unknown-order") {
    console.error(`Thintent webhook names unknown order ${event.externalRef}`);
  } else if (outcome.cancelled) {
    // Only the delivery that cancelled the order gets here, so a redelivery
    // doesn't email the family twice.
    const origin = resolveRequestOrigin(request);
    after(() => sendOrderCancelledEmails(outcome.orderId, origin));
  }
  return Response.json({ received: true, result: outcome.result });
}
