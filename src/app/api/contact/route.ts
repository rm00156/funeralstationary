import type { NextRequest } from "next/server";

import { getSellableProducts } from "@/lib/catalogue.server";
import { CONTACT_TOPICS, contactEmail, validateContactMessage } from "@/lib/contact";
import { isEmailConfigured, sendEmail } from "@/lib/email.server";

export const runtime = "nodejs";

/** Where enquiries go. Never a customer-supplied address — only the reply-to is. */
const recipient = () => process.env.CONTACT_EMAIL || process.env.ORDER_NOTIFY_EMAIL || null;

/**
 * POST /api/contact — the /contact form. Validates the message
 * (validateContactMessage), then emails it to the business with the
 * customer's address as reply-to.
 *
 * Unlike order emails this is not best-effort: if it can't be sent the
 * customer must be told, because the next thing they'd do is wait for a reply
 * that will never come. No mail provider or no recipient → 503, and the form
 * points them at the phone number.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Honeypot: a field no person can see. A bot that fills it gets the same
  // answer as a real send, and nothing is emailed.
  const { website } = (body ?? {}) as Record<string, unknown>;
  if (typeof website === "string" && website.length > 0) {
    return Response.json({ ok: true });
  }

  const products = await getSellableProducts();
  const topics = new Map<string, string>([
    ...products.map((product) => [product.id, product.label] as const),
    ...CONTACT_TOPICS.map((topic) => [topic.id, topic.label] as const),
  ]);
  const result = validateContactMessage(body, topics);
  if (!result.ok) {
    return Response.json(
      { error: "Please check the highlighted fields.", errors: result.errors },
      { status: 400 },
    );
  }

  const to = recipient();
  if (!isEmailConfigured() || !to) {
    return Response.json(
      { error: "Our contact form isn't available right now. Please call or email us instead." },
      { status: 503 },
    );
  }

  try {
    await sendEmail({ to, replyTo: result.message.email, ...contactEmail(result.message) });
  } catch (error) {
    console.error("Contact form email failed", error);
    return Response.json(
      { error: "We couldn't send your message just now. Please try again, or call us." },
      { status: 502 },
    );
  }
  return Response.json({ ok: true });
}
