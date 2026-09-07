"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { adminMutate } from "@/lib/adminClient";
import { ORDER_STATUS_LABELS, ORDER_STATUS_TRANSITIONS, type OrderStatus } from "@/lib/orders";

const fieldInput =
  "rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 py-2 font-body text-sm focus:border-primary-container focus:outline-none focus:ring-4 focus:ring-primary-container/15";

export default function AdminOrderStatusForm({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const router = useRouter();
  const targets = ORDER_STATUS_TRANSITIONS[status];
  const [next, setNext] = useState<OrderStatus | "">("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (targets.length === 0) {
    return (
      <p className="font-body text-sm text-on-surface-variant">
        This order is {ORDER_STATUS_LABELS[status].toLowerCase()} — no further changes.
      </p>
    );
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!next) return;
    setSaving(true);
    setError(null);
    const message = await adminMutate(`/api/admin/orders/${orderId}`, "PATCH", {
      status: next,
      note: note.trim() || undefined,
    });
    setSaving(false);
    if (message) {
      setError(message);
      return;
    }
    setNext("");
    setNote("");
    router.refresh();
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <label htmlFor="order-next-status" className="font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary">
        Move to
      </label>
      <select
        id="order-next-status"
        value={next}
        onChange={(event) => setNext(event.target.value as OrderStatus | "")}
        className={`${fieldInput} w-full`}
      >
        <option value="">Choose a status…</option>
        {targets.map((target) => (
          <option key={target} value={target}>
            {ORDER_STATUS_LABELS[target]}
          </option>
        ))}
      </select>
      <label htmlFor="order-status-note" className="font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary">
        Note (optional)
      </label>
      <textarea
        id="order-status-note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={3}
        maxLength={500}
        placeholder="e.g. Proof emailed to the customer"
        className={`${fieldInput} w-full resize-y`}
      />
      {error && (
        <p role="alert" className="font-body text-xs text-primary">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!next || saving}
        className="rounded-lg bg-primary-container px-4 py-2 font-body text-sm font-medium text-white transition-colors duration-300 hover:bg-primary disabled:opacity-40"
      >
        {saving ? "Saving…" : "Update status"}
      </button>
    </form>
  );
}
