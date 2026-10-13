"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2, UserPlus } from "lucide-react";

import { useConfirmDialog } from "@/components/ConfirmDialog";
import { adminMutate } from "@/lib/adminClient";

const LABEL = "mb-2 block font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary";

export interface AdminTradeMemberRow {
  id: number;
  email: string;
  name: string | null;
  createdAt: string;
}

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

/** Add and remove the people on a trade firm, by email. */
export default function AdminTradeMembers({
  firmId,
  members,
}: {
  firmId: number;
  members: AdminTradeMemberRow[];
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirmDialog();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    setAdding(true);
    setError(null);
    setNotice(null);
    const message = await adminMutate(`/api/admin/trade/${firmId}/members`, "POST", { email, name });
    setAdding(false);
    if (message) {
      setError(message);
      return;
    }
    setNotice(`${email.trim().toLowerCase()} is now on this firm.`);
    setEmail("");
    setName("");
    router.refresh();
  };

  const remove = async (member: AdminTradeMemberRow) => {
    const ok = await confirm({
      title: `Remove ${member.email}?`,
      message: "They'll see an ordinary account from their next page. Their past orders stay on the firm.",
      confirmLabel: "Remove",
    });
    if (!ok) return;
    setRemoving(member.id);
    setError(null);
    setNotice(null);
    const message = await adminMutate(`/api/admin/trade/${firmId}/members/${member.id}`, "DELETE");
    setRemoving(null);
    if (message) {
      setError(message);
      return;
    }
    setNotice(`${member.email} is no longer on this firm.`);
    router.refresh();
  };

  return (
    <>
      <form
        onSubmit={add}
        className="mb-6 grid max-w-2xl gap-4 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 ambient-shadow sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] sm:items-end"
      >
        <div>
          <label htmlFor="trade-member-email" className={LABEL}>
            Email
          </label>
          <input
            id="trade-member-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@firm.co.uk"
            className="field min-h-11 text-base"
          />
        </div>
        <div>
          <label htmlFor="trade-member-name" className={LABEL}>
            Name (optional)
          </label>
          <input
            id="trade-member-name"
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="field min-h-11 text-base"
          />
        </div>
        <button type="submit" disabled={adding || !email} className="btn btn-primary min-h-11 px-5 text-base">
          <UserPlus size={16} aria-hidden />
          {adding ? "Adding…" : "Add"}
        </button>
      </form>

      {notice && (
        <p role="status" className="mb-4 font-body text-sm text-on-surface">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-4 font-body text-sm text-primary">
          {error}
        </p>
      )}

      {members.length === 0 ? (
        <p className="font-body text-on-surface-variant">No one is on this firm yet.</p>
      ) : (
        <ul className="max-w-2xl divide-y divide-outline-variant/30 rounded-xl border border-outline-variant/30 bg-surface-container-lowest ambient-shadow">
          {members.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 font-body text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-on-surface">{member.email}</p>
                <p className="text-on-surface-variant">
                  {member.name ? `${member.name} · ` : ""}added {formatDate(member.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void remove(member)}
                disabled={removing === member.id}
                className="btn btn-ghost min-h-11 px-3 text-sm"
              >
                <Trash2 size={16} aria-hidden />
                {removing === member.id ? "Removing…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {dialog}
    </>
  );
}
