"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldCheck, Trash2, UserPlus } from "lucide-react";

import { useConfirmDialog } from "@/components/ConfirmDialog";
import { adminMutate } from "@/lib/adminClient";

export interface AdminAccessRow {
  id: string;
  email: string;
  isOwner: boolean;
  addedBy: string | null;
  lastSignInAt: string | null;
  createdAt: string;
}

type InviteResult = { email: string; invite: "sent" | "failed" | "not-configured"; signInPageUrl: string };

const formatDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso)) : "Never";

function inviteMessage(result: InviteResult): string {
  if (result.invite === "sent") return `${result.email} now has access — we've emailed them how to sign in.`;
  const reason = result.invite === "failed" ? "the invitation email didn't send" : "email isn't set up";
  return `${result.email} now has access, but ${reason}. Send them this sign-in page yourself: ${result.signInPageUrl}`;
}

/**
 * Grant and remove admin access. The server decides who can be removed (the
 * owner and yourself can't); the buttons are hidden for those rows only so
 * nobody is offered something that will be refused.
 */
export default function AdminAccessManager({
  admins,
  currentEmail,
}: {
  admins: AdminAccessRow[];
  currentEmail: string;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirmDialog();
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    setAdding(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await response.json().catch(() => ({}))) as Partial<InviteResult> & { error?: string };
      if (!response.ok) {
        setError(
          response.status === 401
            ? "Your admin session has expired — sign in again"
            : (body.error ?? "Something went wrong — please try again"),
        );
        return;
      }
      setNotice(inviteMessage(body as InviteResult));
      setEmail("");
      router.refresh();
    } catch {
      setError("Something went wrong — please try again");
    } finally {
      setAdding(false);
    }
  };

  const remove = async (admin: AdminAccessRow) => {
    const ok = await confirm({
      title: `Remove ${admin.email}?`,
      message: "They'll be signed out straight away and won't be able to sign in again unless they're added back.",
      confirmLabel: "Remove access",
    });
    if (!ok) return;
    setRemoving(admin.id);
    setError(null);
    setNotice(null);
    const message = await adminMutate(`/api/admin/access/${admin.id}`, "DELETE");
    setRemoving(null);
    if (message) {
      setError(message);
      return;
    }
    setNotice(`${admin.email} no longer has access.`);
    router.refresh();
  };

  return (
    <>
      <form
        onSubmit={add}
        className="mb-6 max-w-xl rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 ambient-shadow"
      >
        <label
          htmlFor="admin-access-email"
          className="mb-2 block font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary"
        >
          Give someone access
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="admin-access-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            className="field min-h-11 flex-1 text-base"
          />
          <button type="submit" disabled={adding || !email} className="btn btn-primary min-h-11 px-5 text-base">
            <UserPlus size={16} aria-hidden />
            {adding ? "Adding…" : "Add and invite"}
          </button>
        </div>
      </form>

      {notice && (
        <p role="status" className="mb-4 max-w-3xl break-words font-body text-sm text-on-surface">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-4 max-w-3xl font-body text-sm text-primary">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-outline-variant/30 bg-surface-container-lowest ambient-shadow">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="border-b border-outline-variant/40 font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary">
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Added</th>
              <th className="px-5 py-3">Last signed in</th>
              <th className="px-5 py-3 text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {admins.map((admin) => {
              const isMe = admin.email === currentEmail;
              return (
                <tr
                  key={admin.id}
                  className="border-b border-outline-variant/20 font-body text-sm text-on-surface last:border-b-0"
                >
                  <td className="px-5 py-3">
                    <span className="font-medium">{admin.email}</span>
                    {admin.isOwner && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-mist px-2.5 py-0.5 text-xs font-medium text-ink-2">
                        <ShieldCheck size={12} aria-hidden />
                        Owner
                      </span>
                    )}
                    {isMe && <span className="ml-2 text-xs text-on-surface-variant">(you)</span>}
                  </td>
                  <td className="px-5 py-3 text-on-surface-variant">
                    {formatDate(admin.createdAt)}
                    {admin.addedBy && <span className="block text-xs">by {admin.addedBy}</span>}
                  </td>
                  <td className="px-5 py-3 text-on-surface-variant">{formatDate(admin.lastSignInAt)}</td>
                  <td className="px-5 py-3 text-right">
                    {!admin.isOwner && !isMe && (
                      <button
                        type="button"
                        onClick={() => void remove(admin)}
                        disabled={removing === admin.id}
                        className="btn btn-ghost min-h-11 px-3 text-sm"
                      >
                        <Trash2 size={16} aria-hidden />
                        {removing === admin.id ? "Removing…" : "Remove"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {dialog}
    </>
  );
}
