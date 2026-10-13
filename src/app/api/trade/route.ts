import type { NextRequest } from "next/server";

import { getSellableProducts } from "@/lib/catalogue.server";
import { isEmailConfigured, sendEmail } from "@/lib/email.server";
import { clientKey, createRateLimiter } from "@/lib/rateLimit";
import { turnstileFailure, turnstileTokenFrom } from "@/lib/turnstile";
import { verifyTurnstileToken } from "@/lib/turnstile.server";
import { resolveRequestOrigin } from "@/lib/stripe.server";
import { createTradeApplication, findTradeFirmForEmail } from "@/lib/trade.server";
import {
  tradeApplicationEmail,
  tradeOrderTypes,
  validateTradeApplication,
} from "@/lib/tradeApplication";

export const runtime = "nodejs";

/** The contact form's inbox. Never a customer-supplied address — only the reply-to is. */
const recipient = () => process.env.CONTACT_EMAIL || process.env.ORDER_NOTIFY_EMAIL || null;

/** Submissions per IP, checked before the catalogue query. */
const attempts = createRateLimiter({ limit: 20, windowMs: 10 * 60_000 });
/** Applications saved (and emailed) per IP, so a script that gets past validation can't fill the table or spend the Resend quota. */
const sends = createRateLimiter({ limit: 3, windowMs: 60 * 60_000 });

const tooMany = () =>
  Response.json(
    { error: "You've sent us an application already. Please call us if it's urgent." },
    { status: 429 },
  );

/**
 * POST /api/trade — the /trade application form. Validates it
 * (validateTradeApplication), checks its Turnstile token with Cloudflare
 * (turnstile.ts), then saves it as a pending trade_applications row — the
 * record an admin approves or declines in /admin/trade — and emails the shop
 * a heads-up, with the applicant as reply-to.
 *
 * The save is what must work: if it fails, the applicant is told, or they'd
 * wait for a reply that never comes. The email is best-effort, since the
 * application is waiting in admin either way (unlike /api/contact, whose
 * email is the only record). Not gated by the site subscription — like the
 * contact form, it buys nothing.
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

  const result = validateTradeApplication(body, tradeOrderTypes(await getSellableProducts()));
  if (!result.ok) {
    return Response.json(
      { error: "Please check the highlighted fields.", errors: result.errors },
      { status: 400 },
    );
  }

  // Spent once per submission, so only after the cheap checks have passed.
  const human = await verifyTurnstileToken(turnstileTokenFrom(body), ip);
  if (!human.ok) {
    const failure = turnstileFailure(human);
    return Response.json(failure.body, { status: failure.status });
  }

  if (!sends.hit(ip)) return tooMany();
  try {
    await createTradeApplication(result.application);
  } catch (error) {
    console.error("Trade application could not be saved", error);
    return Response.json(
      { error: "We couldn't send your application just now. Please try again, or call us." },
      { status: 503 },
    );
  }

  // Re-applying is allowed (a corrected phone number, a colleague on a shared
  // address); staff are told when the address is already on a firm, and the
  // applicant's answer is the same either way.
  const to = recipient();
  if (isEmailConfigured() && to) {
    try {
      const existing = await findTradeFirmForEmail(result.application.email);
      const reviewUrl = `${resolveRequestOrigin(request)}/admin/trade`;
      await sendEmail({
        to,
        replyTo: result.application.email,
        ...tradeApplicationEmail(result.application, existing, reviewUrl),
      });
    } catch (error) {
      console.error("Trade application email failed (the application is saved)", error);
    }
  }
  return Response.json({ ok: true });
}
