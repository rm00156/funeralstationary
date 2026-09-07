"use client";

import { AlertTriangle, ImageOff } from "lucide-react";

import { issueLocation, type DesignReadiness } from "@/lib/designReadiness";

/**
 * The 409 payload from POST /api/cart/items when the pre-order check refuses
 * a design: either an unprintable design ("blocked") or one the customer must
 * look at once more before it goes in the basket ("confirm").
 */
export interface PreOrderCheck {
  reason: "blocked" | "confirm";
  readiness: DesignReadiness;
}

/** Narrow an arbitrary error body to a pre-order check, or null. */
export function parsePreOrderCheck(body: unknown): PreOrderCheck | null {
  const value = body as Partial<PreOrderCheck> | null;
  if (!value || (value.reason !== "blocked" && value.reason !== "confirm")) return null;
  const readiness = value.readiness;
  if (!readiness || !Array.isArray(readiness.blocking) || !Array.isArray(readiness.warnings)) {
    return null;
  }
  return { reason: value.reason, readiness };
}

/**
 * The last look before a design becomes an order.
 *
 * This is deliberately the *only* moment we interrupt the customer: catching
 * an empty photo window or untouched placeholder wording here, while they are
 * still in front of the editor and can fix it in a click, is worth far more
 * than catching it afterwards when the money has moved.
 */
export default function PreOrderCheckDialog({
  check,
  busy,
  onConfirm,
  onClose,
}: {
  check: PreOrderCheck;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const blocked = check.reason === "blocked";
  const issues = blocked ? check.readiness.blocking : check.readiness.warnings;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pre-order-check-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/70 p-6"
      onClick={onClose}
    >
      <div
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl bg-surface-container-lowest p-8 ambient-shadow"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          {blocked ? (
            <ImageOff size={22} aria-hidden className="mt-1 shrink-0 text-primary" />
          ) : (
            <AlertTriangle size={22} aria-hidden className="mt-1 shrink-0 text-primary" />
          )}
          <div>
            <h2 id="pre-order-check-title" className="font-display text-2xl text-primary">
              {blocked ? "Add your photo first" : "One last look at your wording"}
            </h2>
            <p className="mt-2 font-body text-on-surface-variant">
              {blocked
                ? "Your booklet still has an empty photo window. It would print as an empty box, so we can't add it to your basket yet."
                : "Some wording is still exactly as the template supplied it. That may be just what you want — but please check, because this is what we print."}
            </p>
          </div>
        </div>

        <ul className="mt-6 flex flex-col gap-3">
          {issues.map((issue, index) => (
            <li
              key={`${issue.kind}-${issue.page}-${index}`}
              className="rounded-xl border border-outline-variant/60 bg-surface p-4"
            >
              <p className="font-body text-on-surface">
                {issue.kind === "empty-photo" ? "Empty photo window" : `“${issue.text}”`}
              </p>
              <p className="mt-1 font-body text-sm text-on-surface-variant">
                {issueLocation(issue)}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-5 py-2.5 font-body text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
          >
            {blocked ? "Back to my design" : "Go back and edit"}
          </button>
          {!blocked && (
            <button
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className="rounded-full bg-primary px-6 py-2.5 font-body text-white transition-colors hover:bg-primary-container disabled:opacity-60"
            >
              {busy ? "Adding…" : "That's correct — add to basket"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
