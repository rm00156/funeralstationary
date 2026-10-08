"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Send } from "lucide-react";

import { adminMutate } from "@/lib/adminClient";

/**
 * Send the order to Thintent by hand — for one the automatic send after
 * payment couldn't deliver (the hourly sweep retries too) — or, once it's
 * there, its refunds Thintent hasn't recorded. Safe to press twice: Thintent
 * answers a repeat with the job or credit note it already made.
 */
export default function AdminThintentButton({
  orderId,
  label = "Send to Thintent",
}: {
  orderId: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    const message = await adminMutate(`/api/admin/orders/${orderId}/thintent`, "POST", {});
    setBusy(false);
    if (message) setError(message);
    else router.refresh();
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={send}
        disabled={busy}
        className="inline-flex items-center gap-2 self-start rounded-lg border-2 border-primary-container px-4 py-1.5 font-body text-sm font-medium text-primary-container transition-colors duration-300 hover:bg-surface-container disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} aria-hidden className="animate-spin" /> : <Send size={14} aria-hidden />}
        {busy ? "Sending…" : label}
      </button>
      {error && (
        <p role="alert" className="font-body text-xs text-primary">
          {error}
        </p>
      )}
    </div>
  );
}
