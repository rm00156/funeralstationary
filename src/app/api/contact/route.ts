import type { NextRequest } from "next/server";

import { getSellableProducts } from "@/lib/catalogue.server";
import { contactEmail, contactTopics, validateContactMessage } from "@/lib/contact";
import { isEmailConfigured, sendEmail } from "@/lib/email.server";
import { clientKey, createRateLimiter } from "@/lib/rateLimit";

export const runtime = "nodejs";

/** Where enquiries go. Never a customer-supplied address — only the reply-to is. */
const recipient = () => process.env.CONTACT_EMAIL || process.env.ORDER_NOTIFY_EMAIL || null;

/** Submissions per IP, checked before the catalogue query — generous enough
 * for a person correcting highlighted fields. */
const attempts = createRateLimiter({ limit: 20, windowMs: 10 * 60_000 });
/** Emails per IP. Order confirmations share the Resend quota, so a script
 * that gets past validation can't spend it. */
const sends = createRateLimiter({ limit: 5, windowMs: 60 * 60_000 });

const tooMany = () =>
  Response.json(
    { error: "You've sent us several messages already. Please try again later." },
    { status: 429 },
  );

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

  const ip = clientKey(request.headers);
  if (!attempts.hit(ip)) return tooMany();

  const topics = new Map(
    contactTopics(await getSellableProducts()).map(({ id, label }) => [id, label]),
  );
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

  if (!sends.hit(ip)) return tooMany();
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
