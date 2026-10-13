"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, TriangleAlert, X } from "lucide-react";

import { adminRequest } from "@/lib/adminClient";

const LABEL = "mb-2 block font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary";

export interface AdminTradeApplication {
  id: string;
  status: "pending" | "approved" | "declined";
  businessName: string;
  postcode: string;
  contactName: string;
  role: string;
  email: string;
  phone: string;
  volume: string;
  orders: string[];
  notes: string | null;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionNote: string | null;
  firm: { id: number; name: string } | null;
  existingFirm: { id: number; firmName: string; isActive: boolean } | null;
}

type ApproveResult = {
  firmId: number;
  firmName: string;
  email: string;
  delivery: "sent" | "failed" | "not-configured";
  signInPageUrl: string;
};

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(iso));

function approvedMessage(result: ApproveResult): string {
  const base = `${result.email} is now a trade account on ${result.firmName}`;
  if (result.delivery === "sent") return `${base} — we've emailed them that it's ready.`;
  const reason = result.delivery === "failed" ? "the email to them didn't send" : "email isn't set up";
  return `${base}, but ${reason}. Let them know they can sign in at ${result.signInPageUrl}`;
}

/**
 * /trade applications awaiting a decision, and the latest decisions.
 * Approving makes the firm (or picks an existing one), adds the applicant
 * and emails them; declining sends nothing. The server re-checks everything
 * (trade.server.ts) — a pending card that someone else just decided says so.
 */
export default function AdminTradeApplications({
  pending,
  decided,
  activeFirms,
}: {
  pending: AdminTradeApplication[];
  decided: AdminTradeApplication[];
  activeFirms: { id: number; name: string }[];
}) {
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <section aria-labelledby="trade-applications" className="mb-12">
      <h2 id="trade-applications" className="mb-2 font-display text-2xl font-medium text-primary">
        Applications{pending.length > 0 ? ` (${pending.length} waiting)` : ""}
      </h2>
      <p className="mb-6 max-w-2xl font-body text-on-surface-variant">
        Sent from the trade page. Approving one sets up the firm and the person, and emails them that
        they can sign in. Declining sends nothing — call them if they should hear why.
      </p>

      {notice && (
        <p role="status" className="mb-4 max-w-3xl break-words font-body text-sm text-on-surface">
          {notice}
        </p>
      )}

      {pending.length === 0 ? (
        <p className="mb-8 font-body text-on-surface-variant">No applications waiting.</p>
      ) : (
        <ul className="mb-8 flex max-w-4xl flex-col gap-5">
          {pending.map((application) => (
            <li key={application.id}>
              <PendingApplication application={application} activeFirms={activeFirms} onDone={setNotice} />
            </li>
          ))}
        </ul>
      )}

      {decided.length > 0 && (
        <details className="max-w-4xl rounded-xl border border-outline-variant/30 bg-surface-container-lowest ambient-shadow">
          <summary className="flex min-h-12 cursor-pointer items-center px-5 font-body text-sm font-medium text-on-surface">
            Recent decisions ({decided.length})
          </summary>
          {/* Stacked when its box is under 48rem rather than scrolled sideways; a table above. */}
          <div className="border-t border-outline-variant/30 @container overflow-x-auto">
            <table className="block w-full text-left font-body text-sm @3xl:table @3xl:min-w-[640px]">
              <thead className="hidden @3xl:table-header-group">
                <tr className="border-b border-outline-variant/40 text-xs font-medium uppercase tracking-[0.18em] text-secondary">
                  <th className="px-5 py-3">Applicant</th>
                  <th className="px-5 py-3">Decision</th>
                  <th className="px-5 py-3">When</th>
                </tr>
              </thead>
              <tbody className="block @3xl:table-row-group">
                {decided.map((application) => (
                  <tr
                    key={application.id}
                    className="grid gap-y-1 border-b border-outline-variant/20 px-5 py-4 last:border-b-0 @3xl:table-row @3xl:p-0"
                  >
                    <td className="@3xl:table-cell @3xl:px-5 @3xl:py-3">
                      <span className="font-medium text-on-surface">{application.businessName}</span>
                      <span className="block text-on-surface-variant">
                        {application.contactName} · {application.email}
                      </span>
                    </td>
                    <td className="@3xl:table-cell @3xl:px-5 @3xl:py-3">
                      {application.status === "approved" ? (
                        <>
                          Approved
                          {application.firm && (
                            <>
                              {" onto "}
                              <Link href={`/admin/trade/${application.firm.id}`} className="link">
                                {application.firm.name}
                              </Link>
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          Declined
                          {application.decisionNote && (
                            <span className="block text-on-surface-variant">“{application.decisionNote}”</span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="text-on-surface-variant @3xl:table-cell @3xl:px-5 @3xl:py-3">
                      {application.decidedAt && formatDate(application.decidedAt)}
                      {application.decidedBy && <span className="block text-xs">by {application.decidedBy}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}

function PendingApplication({
  application,
  activeFirms,
  onDone,
}: {
  application: AdminTradeApplication;
  activeFirms: { id: number; name: string }[];
  onDone: (message: string) => void;
}) {
  const router = useRouter();
  const onActiveFirm = application.existingFirm?.isActive ? application.existingFirm : null;
  const [kind, setKind] = useState<"new" | "existing">(onActiveFirm ? "existing" : "new");
  const [name, setName] = useState(application.businessName);
  const [terms, setTerms] = useState("");
  const [discount, setDiscount] = useState("");
  const [onAccount, setOnAccount] = useState(false);
  const [firmId, setFirmId] = useState(String(onActiveFirm?.id ?? activeFirms[0]?.id ?? ""));
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = (suffix: string) => `app-${application.id}-${suffix}`;

  const approve = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const body =
      kind === "new"
        ? { kind, name, paymentTermsDays: terms.trim() === "" ? null : terms, discountPercent: discount.trim(), onAccount }
        : { kind, firmId: Number(firmId) };
    const result = await adminRequest<ApproveResult>(
      `/api/admin/trade/applications/${application.id}/approve`,
      "POST",
      body,
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDone(approvedMessage(result.body));
    router.refresh();
  };

  const decline = async () => {
    setBusy(true);
    setError(null);
    const result = await adminRequest(`/api/admin/trade/applications/${application.id}/decline`, "POST", { note });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDone(`${application.businessName}’s application was declined. Nothing was sent to them.`);
    router.refresh();
  };

  return (
    <article className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 ambient-shadow">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-xl font-medium text-on-surface">{application.businessName}</h3>
        <p className="font-body text-sm text-on-surface-variant">Applied {formatDate(application.createdAt)}</p>
      </header>

      {application.existingFirm && (
        <p className="mb-4 flex items-start gap-2 rounded-lg bg-warn-bg px-4 py-3 font-body text-sm text-warn-text">
          <TriangleAlert size={16} aria-hidden className="mt-0.5 shrink-0" />
          <span>
            {application.email} is already on{" "}
            <Link href={`/admin/trade/${application.existingFirm.id}`} className="font-semibold underline">
              {application.existingFirm.firmName}
            </Link>
            {application.existingFirm.isActive ? "." : " (retired)."}
          </span>
        </p>
      )}

      <dl className="mb-5 grid gap-x-8 gap-y-2 font-body text-sm sm:grid-cols-2">
        {[
          ["Name", `${application.contactName} · ${application.role}`],
          ["Email", application.email],
          ["Phone", application.phone],
          ["Postcode", application.postcode],
          ["Funerals a month", application.volume],
          ["Usually orders", application.orders.length ? application.orders.join(", ") : "Not given"],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-[0.14em] text-secondary">{label}</dt>
            <dd className="break-words text-on-surface">{value}</dd>
          </div>
        ))}
        {application.notes && (
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-[0.14em] text-secondary">Anything else</dt>
            <dd className="whitespace-pre-wrap text-on-surface">{application.notes}</dd>
          </div>
        )}
      </dl>

      {declining ? (
        <div className="flex flex-col gap-3 border-t border-outline-variant/30 pt-5">
          <label htmlFor={field("note")} className={LABEL}>
            Note for staff (optional)
          </label>
          <textarea
            id={field("note")}
            rows={2}
            maxLength={2000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="field resize-y text-base"
          />
          <p className="font-body text-sm text-on-surface-variant">Nothing is emailed to the applicant.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void decline()} disabled={busy} className="btn btn-primary min-h-11 px-5 text-base">
              <X size={16} aria-hidden />
              {busy ? "Declining…" : "Decline application"}
            </button>
            <button type="button" onClick={() => setDeclining(false)} disabled={busy} className="btn btn-ghost min-h-11 px-4 text-base">
              Back
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={approve} className="flex flex-col gap-4 border-t border-outline-variant/30 pt-5">
          <fieldset className="flex flex-wrap gap-x-6 gap-y-2 font-body text-sm text-on-surface">
            <legend className={LABEL}>Approve onto</legend>
            <label className="flex min-h-11 cursor-pointer items-center gap-2">
              <input type="radio" name={field("kind")} checked={kind === "new"} onChange={() => setKind("new")} className="accent-plum" />
              A new firm
            </label>
            <label className={`flex min-h-11 items-center gap-2 ${activeFirms.length ? "cursor-pointer" : "opacity-60"}`}>
              <input
                type="radio"
                name={field("kind")}
                checked={kind === "existing"}
                onChange={() => setKind("existing")}
                disabled={activeFirms.length === 0}
                className="accent-plum"
              />
              An existing firm
            </label>
          </fieldset>

          {kind === "new" ? (
            <>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px_160px]">
              <div>
                <label htmlFor={field("name")} className={LABEL}>
                  Firm name
                </label>
                <input
                  id={field("name")}
                  required
                  maxLength={160}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="field min-h-11 text-base"
                />
              </div>
              <div>
                <label htmlFor={field("terms")} className={LABEL}>
                  Payment terms (days)
                </label>
                <input
                  id={field("terms")}
                  inputMode="numeric"
                  placeholder="e.g. 30"
                  value={terms}
                  onChange={(event) => setTerms(event.target.value)}
                  className="field min-h-11 text-base"
                />
              </div>
              <div>
                <label htmlFor={field("discount")} className={LABEL}>
                  Trade discount (%)
                </label>
                <input
                  id={field("discount")}
                  inputMode="decimal"
                  placeholder="e.g. 10"
                  value={discount}
                  onChange={(event) => setDiscount(event.target.value)}
                  className="field min-h-11 text-base"
                />
              </div>
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 self-start font-body text-sm text-on-surface">
              <input
                type="checkbox"
                checked={onAccount}
                onChange={(event) => setOnAccount(event.target.checked)}
                className="size-4 accent-plum"
              />
              Can order on account (needs payment terms)
            </label>
            </>
          ) : (
            <div className="max-w-md">
              <label htmlFor={field("firm")} className={LABEL}>
                Firm
              </label>
              <select
                id={field("firm")}
                value={firmId}
                onChange={(event) => setFirmId(event.target.value)}
                className="field min-h-11 text-base"
              >
                {activeFirms.map((firm) => (
                  <option key={firm.id} value={firm.id}>
                    {firm.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <p role="alert" className="font-body text-sm text-primary">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy || (kind === "new" ? !name.trim() : !firmId)}
              className="btn btn-primary min-h-11 px-5 text-base"
            >
              <Check size={16} aria-hidden />
              {busy ? "Approving…" : "Approve and email them"}
            </button>
            <button type="button" onClick={() => setDeclining(true)} disabled={busy} className="btn btn-ghost min-h-11 px-4 text-base">
              Decline…
            </button>
          </div>
        </form>
      )}
    </article>
  );
}
