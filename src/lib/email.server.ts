/**
 * Transactional email via Resend. Lazy client, and a silent no-op (returning
 * false) when RESEND_API_KEY / EMAIL_FROM are unset — the same "works without
 * it, does more with it" posture as S3 and Stripe, so a checkout never fails
 * because the mail provider isn't configured yet.
 */
import { Resend } from "resend";

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

let client: Resend | undefined;

function getResend(): Resend {
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

export async function sendEmail(message: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<boolean> {
  const from = process.env.EMAIL_FROM;
  if (!isEmailConfigured() || !from) return false;
  const { error } = await getResend().emails.send({ from, ...message });
  if (error) throw new Error(`Resend: ${error.message}`);
  return true;
}
