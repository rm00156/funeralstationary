"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Copy, Link2, X } from "lucide-react";

/**
 * Forward the proof to family for a second opinion.
 *
 * A funeral is arranged by several people and the one who paid will want a
 * sibling to check the spelling — but the order page itself is scoped to
 * their cookie, so forwarding that link would only 404. This mints a
 * separate read-only link that shows the artwork and nothing else, and can
 * be revoked if it travels further than intended.
 */
export default function OrderProofShare({
  orderId,
  origin,
  initialToken,
}: {
  orderId: string;
  /** Passed from the server so the link renders whole, without waiting for
      hydration to supply window.location. */
  origin: string;
  initialToken: string | null;
}) {
  const router = useRouter();
  const [token, setToken] = useState(initialToken);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url = token ? `${origin}/proof/${token}` : null;

  const call = async (method: "POST" | "DELETE") => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${orderId}/share`, { method });
      if (!response.ok) throw new Error("Could not update the link — please try again");
      const payload = (await response.json()) as { token: string | null };
      setToken(payload.token);
      setCopied(false);
      if (payload.token) {
        await navigator.clipboard
          .writeText(`${origin}/proof/${payload.token}`)
          .then(() => setCopied(true))
          .catch(() => undefined);
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError("Could not copy — select the link and copy it manually");
    }
  };

  return (
    <section className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6">
      <h2 className="mb-2 font-display text-xl text-primary">Share with family</h2>
      <p className="font-body text-sm text-on-surface-variant">
        Send a read-only link to anyone who should see the proof. They can view it but
        only you can approve it.
      </p>

      {token && url ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="break-all rounded-lg bg-surface-container px-3 py-2 font-body text-xs text-on-surface">
            {url}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void copy()}
              className="inline-flex items-center gap-2 rounded-lg border-2 border-primary-container px-4 py-2 font-body text-sm font-medium text-primary-container transition-colors hover:bg-surface-container"
            >
              {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
              {copied ? "Copied" : "Copy link"}
            </button>
            <button
              type="button"
              onClick={() => void call("DELETE")}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 font-body text-sm font-medium text-on-surface-variant transition-colors hover:text-primary disabled:opacity-60"
            >
              <X size={16} aria-hidden />
              Stop sharing
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void call("POST")}
          disabled={busy}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border-2 border-primary-container px-4 py-2 font-body text-sm font-medium text-primary-container transition-colors hover:bg-surface-container disabled:opacity-60"
        >
          <Link2 size={16} aria-hidden />
          {busy ? "Creating…" : "Create a share link"}
        </button>
      )}

      {error && (
        <p role="alert" className="mt-3 font-body text-sm text-primary">
          {error}
        </p>
      )}
    </section>
  );
}
