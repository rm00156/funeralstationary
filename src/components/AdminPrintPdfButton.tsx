"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";

import { adminMutate } from "@/lib/adminClient";

/**
 * Render the press file for one proof version. Deliberately on demand: the
 * PDF is expensive, only the printer reads it, and it should be made from
 * the artwork the customer approved rather than speculatively at payment.
 */
export default function AdminPrintPdfButton({
  orderId,
  proofId,
}: {
  orderId: string;
  proofId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    const message = await adminMutate(
      `/api/admin/orders/${orderId}/proofs/${proofId}/pdf`,
      "POST",
      {},
    );
    setBusy(false);
    if (message) setError(message);
    else router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={generate}
        disabled={busy}
        title="Render the print-ready PDF for the press"
        className="inline-flex items-center gap-1 font-body text-xs font-medium text-primary-container underline-offset-2 hover:underline disabled:opacity-50"
      >
        {busy ? (
          <Loader2 size={12} aria-hidden className="animate-spin" />
        ) : (
          <FileDown size={12} aria-hidden />
        )}
        {busy ? "Rendering…" : "make print PDF"}
      </button>
      {error && (
        <span role="alert" className="font-body text-xs text-primary">
          {error}
        </span>
      )}
    </>
  );
}
