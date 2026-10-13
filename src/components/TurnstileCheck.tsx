"use client";

import { Turnstile } from "@marsidev/react-turnstile";

import { TURNSTILE_SITE_KEY } from "@/lib/turnstile";

/**
 * Cloudflare's "are you a person" check, above a form's submit button — the
 * same widget and settings as simple-print's forms. It reports the token, or
 * null when the token expires or the check fails; the form keeps its submit
 * button off until it has one. Change `resetKey` to start a fresh check: a
 * token is spent by every submission the server checks, so a form resets it
 * after any refused send.
 */
export default function TurnstileCheck({
  resetKey,
  onToken,
}: {
  resetKey: number;
  onToken: (token: string | null) => void;
}) {
  return (
    <Turnstile
      key={resetKey}
      siteKey={TURNSTILE_SITE_KEY}
      // The site has no dark theme; the form sends the token itself, so no hidden field.
      options={{ theme: "light", size: "flexible", responseField: false }}
      onSuccess={(token) => onToken(token)}
      onExpire={() => onToken(null)}
      onError={() => onToken(null)}
    />
  );
}
