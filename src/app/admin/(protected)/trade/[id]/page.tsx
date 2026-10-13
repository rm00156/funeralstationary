import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import AdminTradeFirmForm from "@/components/AdminTradeFirmForm";
import AdminTradeMembers from "@/components/AdminTradeMembers";
import { parseTradeId } from "@/lib/trade";
import { getTradeFirm } from "@/lib/trade.server";

export const dynamic = "force-dynamic";

/** /admin/trade/:id — one firm: its name, terms and whether it's active, and its people. */
export default async function AdminTradeFirmPage({ params }: PageProps<"/admin/trade/[id]">) {
  const id = parseTradeId((await params).id);
  const firm = id ? await getTradeFirm(id) : null;
  if (!firm) notFound();

  return (
    <>
      <Link
        href="/admin/trade"
        className="mb-4 inline-flex min-h-11 items-center gap-1 font-body text-sm text-on-surface-variant hover:text-primary"
      >
        <ChevronLeft size={16} aria-hidden />
        Trade accounts
      </Link>
      <h1 className="mb-2 font-display text-3xl font-medium text-primary">{firm.name}</h1>
      <p className="mb-8 font-body text-on-surface-variant">
        {firm.orderCount} {firm.orderCount === 1 ? "order" : "orders"} placed on this account.
      </p>

      <AdminTradeFirmForm
        firm={{
          id: firm.id,
          name: firm.name,
          paymentTermsDays: firm.paymentTermsDays,
          discountPercent: firm.discountPercent,
          onAccount: firm.onAccount,
          accountsEmail: firm.accountsEmail,
          isActive: firm.isActive,
        }}
      />

      <h2 className="mb-2 mt-10 font-display text-2xl font-medium text-primary">People</h2>
      <p className="mb-6 max-w-2xl font-body text-on-surface-variant">
        Anyone listed here sees the trade view when they sign in with this email. Nothing is sent to
        them — let them know they can sign in at My account. Removing someone changes their view
        straight away; their past orders stay on the firm.
      </p>
      <AdminTradeMembers
        firmId={firm.id}
        members={firm.members.map((member) => ({
          id: member.id,
          email: member.email,
          name: member.name,
          createdAt: member.createdAt.toISOString(),
        }))}
      />
    </>
  );
}
