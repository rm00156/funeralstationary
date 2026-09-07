"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw } from "lucide-react";

import { adminMutate } from "@/lib/adminClient";

export default function AdminOrderProofActions({
  orderId,
  itemId,
  hasProof,
}: {
  orderId: string;
  itemId: string;
  hasProof: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const regenerate = async () => {
    setBusy(true);
    setError(null);
    const message = await adminMutate(
      `/api/admin/orders/${orderId}/items/${itemId}/proof`,
      "POST",
      {},
    );
    setBusy(false);
    if (message) setError(message);
    else router.refresh();
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={regenerate}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg border-2 border-primary-container px-4 py-1.5 font-body text-sm font-medium text-primary-container transition-colors duration-300 hover:bg-surface-container disabled:opacity-50"
      >
        <RefreshCw size={14} aria-hidden className={busy ? "animate-spin" : undefined} />
        {busy ? "Rendering…" : hasProof ? "Regenerate proof" : "Generate proof"}
      </button>
      {error && (
        <p role="alert" className="font-body text-xs text-primary">
          {error}
        </p>
      )}
    </div>
  );
}
