"use client";

import { useState } from "react";
import { MailCheck, Send } from "lucide-react";

/**
 * Email-only sign-in. There is no password: the form asks for an address,
 * the server emails a one-time link, and clicking it signs the customer in.
 * Lives on the account page, which is also where an order opened on another
 * device sends a guest to sign in.
 */
export default function SignInForm({
  next,
  initialEmail = "",
  submitLabel = "Email me a sign-in link",
  autoFocus = false,
  onSent,
}: {
  /** Where to land after the link is clicked. Site-relative. */
  next?: string;
  initialEmail?: string;
  submitLabel?: string;
  autoFocus?: boolean;
  onSent?: (email: string) => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [sentTo, setSentTo] = useState<string | null>(null);
  /** Development without email set up: the link we would have sent. */
  const [developmentLink, setDevelopmentLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, next }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        developmentLink?: string | null;
      };
      if (!response.ok) {
        throw new Error(body.error || "We couldn't send your link just now — please try again.");
      }
      setDevelopmentLink(body.developmentLink ?? null);
      setSentTo(email.trim());
      onSent?.(email.trim());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (sentTo) {
    return (
      <div role="status" className="flex items-start gap-3">
        <MailCheck size={22} aria-hidden className="mt-0.5 shrink-0 text-secondary" />
        <div>
          <p className="font-display text-xl text-primary">Check your email</p>
          <p className="mt-1 font-body text-sm text-on-surface-variant">
            We have sent a sign-in link to <strong className="text-on-surface">{sentTo}</strong>.
            It works once and expires in 15 minutes. Open it on whichever device you want to
            use — that device is then signed in.
          </p>
          {developmentLink && (
            <p className="mt-3 rounded-lg bg-surface-container-low px-4 py-3 font-body text-sm text-on-surface-variant">
              Email isn&apos;t set up on this computer, so nothing was sent.{" "}
              <a href={developmentLink} className="font-medium text-primary underline underline-offset-2">
                Open the sign-in link
              </a>
            </p>
          )}
          <button
            type="button"
            onClick={() => setSentTo(null)}
            className="mt-3 font-body text-sm text-primary underline-offset-2 hover:underline"
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label
        htmlFor="sign-in-email"
        className="block font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary"
      >
        Your email address
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="sign-in-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus={autoFocus}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="w-full flex-1 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 font-body text-base text-on-surface transition-colors duration-300 focus:border-primary-container focus:outline-none focus:ring-4 focus:ring-primary-container/15"
        />
        <button
          type="submit"
          disabled={submitting || !email}
          className="flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-primary-container px-5 py-3 font-body text-sm font-medium tracking-wide text-white transition-colors duration-300 hover:bg-primary disabled:opacity-60"
        >
          <Send size={16} aria-hidden />
          {submitting ? "Sending…" : submitLabel}
        </button>
      </div>
      {error && (
        <p role="alert" className="font-body text-sm text-primary">
          {error}
        </p>
      )}
      <p className="font-body text-xs text-on-surface-variant">
        No password to remember — we email you a link, and clicking it signs you in.
      </p>
    </form>
  );
}
