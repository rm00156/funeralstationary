"use client";

import { useState } from "react";
import { MailCheck, Send } from "lucide-react";

/**
 * Admin sign-in by emailed link. The server answers the same for every
 * address, so "check your email" is shown whether or not one was sent — only
 * an address with admin access actually receives a link.
 */
export default function AdminLoginForm({ initialEmail = "" }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [sentTo, setSentTo] = useState<string | null>(null);
  /** Development without email set up: any link was printed in the server's terminal. */
  const [linkInTerminal, setLinkInTerminal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        linkInTerminal?: boolean;
      };
      if (!response.ok) {
        setError(body.error ?? "We couldn't send your link just now — please try again.");
        return;
      }
      setLinkInTerminal(body.linkInTerminal === true);
      setSentTo(email.trim());
    } catch {
      setError("We couldn't send your link just now — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (sentTo) {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-8 ambient-shadow"
      >
        <MailCheck size={22} aria-hidden className="mt-0.5 shrink-0 text-secondary" />
        <div>
          <p className="font-display text-xl text-primary">Check your email</p>
          <p className="mt-1 font-body text-sm text-on-surface-variant">
            If <strong className="text-on-surface">{sentTo}</strong> has admin access, we have sent it a
            sign-in link. It works once and expires in 15 minutes.
          </p>
          {linkInTerminal && (
            <p className="mt-3 rounded-lg bg-surface-container-low px-4 py-3 font-body text-sm text-on-surface-variant">
              Email isn&apos;t set up on this computer, so nothing was sent. If the address has access, the
              sign-in link is in the terminal running the server.
            </p>
          )}
          <button
            type="button"
            onClick={() => setSentTo(null)}
            className="mt-3 min-h-11 font-body text-sm text-primary underline-offset-2 hover:underline"
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-8 ambient-shadow"
    >
      <label
        htmlFor="admin-email"
        className="mb-2 block font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary"
      >
        Your email address
      </label>
      <input
        id="admin-email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoFocus
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="field min-h-11 text-base"
      />
      {error && (
        <p role="alert" className="mt-3 font-body text-sm text-primary">
          {error}
        </p>
      )}
      <button type="submit" disabled={submitting || !email} className="btn btn-primary mt-6 min-h-11 w-full">
        <Send size={16} aria-hidden />
        {submitting ? "Sending…" : "Email me a sign-in link"}
      </button>
      <p className="mt-4 font-body text-xs text-on-surface-variant">
        No password — we email you a link, and clicking it signs you in.
      </p>
    </form>
  );
}
