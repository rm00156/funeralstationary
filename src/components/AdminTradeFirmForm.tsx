"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { adminRequest } from "@/lib/adminClient";

const LABEL = "mb-2 block font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary";

export interface AdminTradeFirm {
  id: number;
  name: string;
  paymentTermsDays: number | null;
  discountPercent: number;
  onAccount: boolean;
  accountsEmail: string | null;
  isActive: boolean;
}

/**
 * Create a trade firm (no `firm`) or edit one. Creating goes to the new
 * firm's page, where its people are added.
 */
export default function AdminTradeFirmForm({ firm }: { firm?: AdminTradeFirm }) {
  const router = useRouter();
  const [name, setName] = useState(firm?.name ?? "");
  const [terms, setTerms] = useState(firm?.paymentTermsDays?.toString() ?? "");
  const [isActive, setIsActive] = useState(firm?.isActive ?? true);
  const [discount, setDiscount] = useState(firm && firm.discountPercent > 0 ? String(firm.discountPercent) : "");
  const [onAccount, setOnAccount] = useState(firm?.onAccount ?? false);
  const [accountsEmail, setAccountsEmail] = useState(firm?.accountsEmail ?? "");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    const body = {
      name,
      paymentTermsDays: terms.trim() === "" ? null : terms,
      discountPercent: discount.trim(),
      onAccount,
      accountsEmail,
    };
    const result = firm
      ? await adminRequest(`/api/admin/trade/${firm.id}`, "PATCH", { ...body, isActive })
      : await adminRequest<{ id: number }>("/api/admin/trade", "POST", body);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (!firm) {
      router.push(`/admin/trade/${(result.body as { id: number }).id}`);
      return;
    }
    setNotice("Saved.");
    router.refresh();
  };

  return (
    <form
      onSubmit={submit}
      className="mb-8 flex max-w-2xl flex-col gap-5 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 ambient-shadow"
    >
      {!firm && <h2 className="font-display text-xl font-medium text-primary">Add a firm</h2>}
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
        <div>
          <label htmlFor={`trade-firm-name-${firm?.id ?? "new"}`} className={LABEL}>
            Firm name
          </label>
          <input
            id={`trade-firm-name-${firm?.id ?? "new"}`}
            required
            maxLength={160}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="field min-h-11 text-base"
          />
        </div>
        <div>
          <label htmlFor={`trade-firm-terms-${firm?.id ?? "new"}`} className={LABEL}>
            Payment terms (days)
          </label>
          <input
            id={`trade-firm-terms-${firm?.id ?? "new"}`}
            inputMode="numeric"
            placeholder="e.g. 30"
            value={terms}
            onChange={(event) => setTerms(event.target.value)}
            aria-describedby={`trade-firm-terms-help-${firm?.id ?? "new"}`}
            className="field min-h-11 text-base"
          />
        </div>
      </div>
      <p id={`trade-firm-terms-help-${firm?.id ?? "new"}`} className="-mt-2 font-body text-sm text-on-surface-variant">
        Net terms: days after Thintent sends the invoice. Needed to order on account.
      </p>
      <div className="max-w-[200px]">
        <label htmlFor={`trade-firm-discount-${firm?.id ?? "new"}`} className={LABEL}>
          Trade discount (%)
        </label>
        <input
          id={`trade-firm-discount-${firm?.id ?? "new"}`}
          inputMode="decimal"
          placeholder="e.g. 10"
          value={discount}
          onChange={(event) => setDiscount(event.target.value)}
          aria-describedby={`trade-firm-discount-help-${firm?.id ?? "new"}`}
          className="field min-h-11 text-base"
        />
      </div>
      <p id={`trade-firm-discount-help-${firm?.id ?? "new"}`} className="-mt-2 font-body text-sm text-on-surface-variant">
        Taken off every print price their people see and pay. Delivery stays full price. Blank for none.
      </p>
      <label className="flex min-h-11 cursor-pointer items-center gap-2.5 self-start font-body text-sm text-on-surface">
        <input
          type="checkbox"
          checked={onAccount}
          onChange={(event) => setOnAccount(event.target.checked)}
          className="size-4 accent-plum"
        />
        Can order on account — no card at checkout; Thintent invoices them on the terms above
      </label>
      <div className="max-w-md">
        <label htmlFor={`trade-firm-accounts-${firm?.id ?? "new"}`} className={LABEL}>
          Accounts email (optional)
        </label>
        <input
          id={`trade-firm-accounts-${firm?.id ?? "new"}`}
          type="email"
          inputMode="email"
          placeholder="accounts@firm.co.uk"
          value={accountsEmail}
          onChange={(event) => setAccountsEmail(event.target.value)}
          className="field min-h-11 text-base"
        />
        <p className="mt-1.5 font-body text-sm text-on-surface-variant">
          Where Thintent sends their invoices. Blank sends them to whoever placed the order.
        </p>
      </div>
      {firm && (
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 self-start font-body text-sm text-on-surface">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
            className="size-4 accent-plum"
          />
          Active — untick to retire the firm and turn its trade view off
        </label>
      )}
      {notice && (
        <p role="status" className="font-body text-sm text-on-surface">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="font-body text-sm text-primary">
          {error}
        </p>
      )}
      <button type="submit" disabled={saving || !name.trim()} className="btn btn-primary min-h-11 self-start px-5 text-base">
        {saving ? "Saving…" : firm ? "Save" : "Add firm"}
      </button>
    </form>
  );
}
