"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, MessageSquare } from "lucide-react";

import { ARTBOARD_H_MM, ARTBOARD_W_MM } from "@/lib/designEditor";
import type { OrderProofSummary } from "@/lib/orders.server";

const PAGE_ASPECT = ARTBOARD_W_MM / ARTBOARD_H_MM;

/**
 * The customer's proof: the page images, and the two answers they can give.
 *
 * There is deliberately no download here. The print-ready PDF is the press's
 * file, and a print-resolution page is tens of megabytes — nobody should be
 * asked to download that to check a date.
 */
export default function OrderProofReview({
  orderId,
  proof,
}: {
  orderId: string;
  proof: OrderProofSummary;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  const respond = async (decision: "approved" | "changes_requested") => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${orderId}/proofs/${proof.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Something went wrong — please try again");
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-5 border-t border-outline-variant/40 pt-5">
      <h3 className="font-display text-lg text-primary">Your proof</h3>
      <p className="mt-1 font-body text-sm text-on-surface-variant">
        Please check every page carefully — names, dates and spellings especially.
      </p>

      <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {proof.pages.map((page) => (
          <li key={page.pageIndex} className="flex flex-col gap-1.5">
            <div
              className="relative overflow-hidden rounded-lg border border-outline-variant/60 bg-surface-container-lowest"
              style={{ aspectRatio: PAGE_ASPECT }}
            >
              <Image
                src={page.imageUrl}
                alt={`Page ${page.pageIndex + 1} of your proof`}
                fill
                sizes="(max-width: 640px) 45vw, 30vw"
                className="object-contain"
              />
            </div>
            <span className="text-center font-body text-xs text-on-surface-variant">
              Page {page.pageIndex + 1}
            </span>
          </li>
        ))}
      </ul>

      {proof.status === "approved" && (
        <p className="mt-4 flex items-center gap-2 font-body text-sm text-secondary">
          <CheckCircle2 size={16} aria-hidden />
          You approved this proof — it is queued for printing.
        </p>
      )}

      {proof.status === "changes_requested" && (
        <p className="mt-4 flex items-center gap-2 font-body text-sm text-on-surface-variant">
          <MessageSquare size={16} aria-hidden />
          You asked for changes. We will send a new proof shortly.
        </p>
      )}

      {proof.status === "sent" && (
        <div className="mt-5 flex flex-col gap-3">
          {noteOpen && (
            <label className="flex flex-col gap-1.5">
              <span className="font-body text-sm text-on-surface">What needs changing?</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="For example: the date on page 2 should be 14 March."
                className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body text-sm text-on-surface"
              />
            </label>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void respond("approved")}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-container px-5 py-2.5 font-body text-sm font-medium text-white transition-colors hover:bg-primary disabled:opacity-60"
            >
              <CheckCircle2 size={16} aria-hidden />
              Approve and print
            </button>
            <button
              type="button"
              onClick={() => (noteOpen ? void respond("changes_requested") : setNoteOpen(true))}
              disabled={busy || (noteOpen && !note.trim())}
              className="inline-flex items-center gap-2 rounded-lg border-2 border-primary-container px-5 py-2.5 font-body text-sm font-medium text-primary-container transition-colors hover:bg-surface-container disabled:opacity-60"
            >
              <MessageSquare size={16} aria-hidden />
              {noteOpen ? "Send change request" : "Request a change"}
            </button>
          </div>
          {error && (
            <p role="alert" className="font-body text-sm text-primary">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
