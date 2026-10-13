import { cache } from "react";
import { and, asc, count, desc, eq, inArray, ne } from "drizzle-orm";

import { db } from "@/db";
import { isDuplicateKeyError } from "@/db/errors";
import { orders, tradeApplications, tradeFirms, tradeMembers, type TradeApplicationStatus } from "@/db/schema";
import { accountSignInPageUrl } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth.server";
import { isEmailConfigured, sendEmail } from "@/lib/email.server";
import { tradeAccountReadyEmail } from "@/lib/orderEmails";
import type { TradeApproval, TradeFirmInput, TradeMemberInput, TradeMembership } from "@/lib/trade";
import type { ExistingTradeFirm, TradeApplication } from "@/lib/tradeApplication";

/**
 * The trade-account seam (rules in trade.ts). An email is trade when it is
 * listed on an active firm — that is the whole of the detection, read on
 * every request so removing someone from a firm (or retiring the firm)
 * takes effect at once, as removing an admin does.
 */
export async function getTradeMembership(email: string): Promise<TradeMembership | null> {
  const [row] = await db
    .select({
      firmId: tradeFirms.id,
      firmName: tradeFirms.name,
      memberName: tradeMembers.name,
      paymentTermsDays: tradeFirms.paymentTermsDays,
      discountPercent: tradeFirms.discountPercent,
      onAccount: tradeFirms.onAccount,
      accountsEmail: tradeFirms.accountsEmail,
    })
    .from(tradeMembers)
    .innerJoin(tradeFirms, eq(tradeMembers.firmId, tradeFirms.id))
    .where(and(eq(tradeMembers.email, email.toLowerCase()), eq(tradeFirms.isActive, true)))
    .limit(1);
  if (!row) return null;
  // On account needs terms to invoice on; the admin form insists, this makes sure.
  return {
    ...row,
    discountPercent: Number(row.discountPercent),
    onAccount: row.onAccount && row.paymentTermsDays !== null,
  };
}

/** A firm's input as the table stores it (decimal columns are strings). */
const firmColumns = (input: TradeFirmInput) => ({
  name: input.name,
  paymentTermsDays: input.paymentTermsDays,
  discountPercent: input.discountPercent.toFixed(2),
  onAccount: input.onAccount,
  accountsEmail: input.accountsEmail,
});

/**
 * The firm an address is on, retired or not — for the note on a /trade
 * application's staff email. Never shown to the applicant.
 */
export async function findTradeFirmForEmail(email: string): Promise<ExistingTradeFirm | null> {
  const [row] = await db
    .select({ firmName: tradeFirms.name, isActive: tradeFirms.isActive })
    .from(tradeMembers)
    .innerJoin(tradeFirms, eq(tradeMembers.firmId, tradeFirms.id))
    .where(eq(tradeMembers.email, email.trim().toLowerCase()))
    .limit(1);
  return row ?? null;
}

/** The signed-in customer's firm, or null for a family (or nobody signed in). React-cached. */
export const getCurrentTradeMembership = cache(async (): Promise<TradeMembership | null> => {
  const user = await getCurrentUser();
  return user ? getTradeMembership(user.email) : null;
});

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export class TradeAdminError extends Error {
  constructor(
    public readonly status: 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

export interface TradeFirmSummary {
  id: number;
  name: string;
  paymentTermsDays: number | null;
  discountPercent: number;
  onAccount: boolean;
  accountsEmail: string | null;
  isActive: boolean;
  memberCount: number;
  orderCount: number;
  createdAt: Date;
}

export interface TradeFirmDetail extends Omit<TradeFirmSummary, "memberCount"> {
  members: { id: number; email: string; name: string | null; createdAt: Date }[];
}

export async function listTradeFirms(): Promise<TradeFirmSummary[]> {
  const [firms, members, orderCounts] = await Promise.all([
    db.select().from(tradeFirms).orderBy(asc(tradeFirms.name)),
    db.select({ firmId: tradeMembers.firmId, n: count() }).from(tradeMembers).groupBy(tradeMembers.firmId),
    // Placed orders only: checkout stamps the firm on the basket before payment.
    db
      .select({ firmId: orders.tradeFirmId, n: count() })
      .from(orders)
      .where(ne(orders.status, "draft"))
      .groupBy(orders.tradeFirmId),
  ]);
  const memberCount = new Map(members.map((row) => [row.firmId, row.n]));
  const orderCount = new Map(orderCounts.map((row) => [row.firmId, row.n]));
  return firms.map((firm) => ({
    id: firm.id,
    name: firm.name,
    paymentTermsDays: firm.paymentTermsDays,
    discountPercent: Number(firm.discountPercent),
    onAccount: firm.onAccount,
    accountsEmail: firm.accountsEmail,
    isActive: firm.isActive,
    memberCount: memberCount.get(firm.id) ?? 0,
    orderCount: orderCount.get(firm.id) ?? 0,
    createdAt: firm.createdAt,
  }));
}

export async function getTradeFirm(id: number): Promise<TradeFirmDetail | null> {
  const [firm] = await db.select().from(tradeFirms).where(eq(tradeFirms.id, id)).limit(1);
  if (!firm) return null;
  const [members, [orderCount]] = await Promise.all([
    db
      .select({ id: tradeMembers.id, email: tradeMembers.email, name: tradeMembers.name, createdAt: tradeMembers.createdAt })
      .from(tradeMembers)
      .where(eq(tradeMembers.firmId, id))
      .orderBy(asc(tradeMembers.email)),
    db.select({ n: count() }).from(orders).where(and(eq(orders.tradeFirmId, id), ne(orders.status, "draft"))),
  ]);
  return {
    id: firm.id,
    name: firm.name,
    paymentTermsDays: firm.paymentTermsDays,
    discountPercent: Number(firm.discountPercent),
    onAccount: firm.onAccount,
    accountsEmail: firm.accountsEmail,
    isActive: firm.isActive,
    orderCount: orderCount?.n ?? 0,
    createdAt: firm.createdAt,
    members,
  };
}

export async function createTradeFirm(input: TradeFirmInput): Promise<number> {
  const [result] = await db.insert(tradeFirms).values(firmColumns(input));
  return result.insertId;
}

export async function updateTradeFirm(
  id: number,
  input: TradeFirmInput & { isActive: boolean },
): Promise<void> {
  // Checked first: an UPDATE that changes nothing can report no affected rows.
  await requireFirm(id);
  await db
    .update(tradeFirms)
    .set({ ...firmColumns(input), isActive: input.isActive })
    .where(eq(tradeFirms.id, id));
}

async function requireFirm(id: number): Promise<void> {
  const [firm] = await db.select({ id: tradeFirms.id }).from(tradeFirms).where(eq(tradeFirms.id, id)).limit(1);
  if (!firm) throw new TradeAdminError(404, "That firm no longer exists.");
}

/** Add a person. One address belongs to one firm, so a second firm's claim on it is refused. */
export async function addTradeMember(firmId: number, input: TradeMemberInput): Promise<void> {
  await requireFirm(firmId);
  try {
    await db.insert(tradeMembers).values({ firmId, ...input });
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const [holder] = await db
      .select({ name: tradeFirms.name })
      .from(tradeMembers)
      .innerJoin(tradeFirms, eq(tradeMembers.firmId, tradeFirms.id))
      .where(eq(tradeMembers.email, input.email))
      .limit(1);
    throw new TradeAdminError(
      409,
      holder ? `${input.email} is already on ${holder.name}.` : `${input.email} is already on a firm.`,
    );
  }
}

/** Remove a person: their next page load is a family's view again. Their past orders keep the firm. */
export async function removeTradeMember(firmId: number, memberId: number): Promise<void> {
  const [result] = await db
    .delete(tradeMembers)
    .where(and(eq(tradeMembers.id, memberId), eq(tradeMembers.firmId, firmId)));
  if (result.affectedRows === 0) throw new TradeAdminError(404, "That person is no longer on this firm.");
}

/* ------------------------------------------------------------------ */
/* Applications (/trade → /admin/trade)                                */
/* ------------------------------------------------------------------ */

/** Save a validated /trade application as pending. It is the record; the shop's email only points at it. */
export async function createTradeApplication(application: TradeApplication): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(tradeApplications).values({
    id,
    businessName: application.businessName,
    postcode: application.postcode,
    contactName: application.name,
    role: application.role,
    email: application.email.toLowerCase(),
    phone: application.phone,
    volume: application.volume,
    orders: application.orders,
    notes: application.notes,
  });
  return id;
}

export interface TradeApplicationRow {
  id: string;
  status: TradeApplicationStatus;
  businessName: string;
  postcode: string;
  contactName: string;
  role: string;
  email: string;
  phone: string;
  volume: string;
  orders: string[];
  notes: string | null;
  createdAt: Date;
  decidedAt: Date | null;
  decidedBy: string | null;
  decisionNote: string | null;
  /** The firm it was approved into. */
  firm: { id: number; name: string } | null;
  /** The firm the address is on today, if any — the "already a customer" warning on a pending one. */
  existingFirm: (ExistingTradeFirm & { id: number }) | null;
}

/** How many applications wait for a decision — the sidebar badge and the Today notice. */
export async function countPendingTradeApplications(): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(tradeApplications)
    .where(eq(tradeApplications.status, "pending"));
  return row?.n ?? 0;
}

/** Every pending application, oldest first, then the latest decisions. */
export async function listTradeApplications(
  decidedLimit = 20,
): Promise<{ pending: TradeApplicationRow[]; decided: TradeApplicationRow[] }> {
  const [pendingRows, decidedRows] = await Promise.all([
    db
      .select()
      .from(tradeApplications)
      .where(eq(tradeApplications.status, "pending"))
      .orderBy(asc(tradeApplications.createdAt)),
    db
      .select()
      .from(tradeApplications)
      .where(ne(tradeApplications.status, "pending"))
      .orderBy(desc(tradeApplications.decidedAt))
      .limit(decidedLimit),
  ]);
  const all = [...pendingRows, ...decidedRows];
  const firmIds = [...new Set(all.map((row) => row.firmId).filter((id): id is number => id !== null))];
  const emails = [...new Set(pendingRows.map((row) => row.email))];
  const [firms, members] = await Promise.all([
    firmIds.length
      ? db.select({ id: tradeFirms.id, name: tradeFirms.name }).from(tradeFirms).where(inArray(tradeFirms.id, firmIds))
      : [],
    emails.length
      ? db
          .select({ email: tradeMembers.email, id: tradeFirms.id, firmName: tradeFirms.name, isActive: tradeFirms.isActive })
          .from(tradeMembers)
          .innerJoin(tradeFirms, eq(tradeMembers.firmId, tradeFirms.id))
          .where(inArray(tradeMembers.email, emails))
      : [],
  ]);
  const firmById = new Map(firms.map((firm) => [firm.id, firm]));
  const firmByEmail = new Map(members.map(({ email, ...firm }) => [email, firm]));
  const toRow = (row: (typeof all)[number]): TradeApplicationRow => ({
    id: row.id,
    status: row.status,
    businessName: row.businessName,
    postcode: row.postcode,
    contactName: row.contactName,
    role: row.role,
    email: row.email,
    phone: row.phone,
    volume: row.volume,
    orders: row.orders,
    notes: row.notes,
    createdAt: row.createdAt,
    decidedAt: row.decidedAt,
    decidedBy: row.decidedBy,
    decisionNote: row.decisionNote,
    firm: row.firmId ? (firmById.get(row.firmId) ?? null) : null,
    existingFirm: row.status === "pending" ? (firmByEmail.get(row.email) ?? null) : null,
  });
  return { pending: pendingRows.map(toRow), decided: decidedRows.map(toRow) };
}

async function requirePendingApplication(id: string) {
  const [row] = await db.select().from(tradeApplications).where(eq(tradeApplications.id, id)).limit(1);
  if (!row) throw new TradeAdminError(404, "That application no longer exists.");
  if (row.status !== "pending") {
    throw new TradeAdminError(409, `That application has already been ${row.status}.`);
  }
  return row;
}

export type ReadyEmailDelivery = "sent" | "failed" | "not-configured";

/**
 * Approve an application: into a new firm, or onto an existing (active)
 * one, adding the applicant's email and name as a person on it — all in one
 * transaction, the application's move from pending conditional on it still
 * being pending, so two admins can't approve it twice. Then, best-effort,
 * the "your trade account is ready" email; how that went is returned, with
 * the sign-in page to pass on by hand when it didn't go.
 */
export async function approveTradeApplication(
  id: string,
  approval: TradeApproval,
  decidedBy: string,
  origin: string,
): Promise<{ firmId: number; firmName: string; email: string; delivery: ReadyEmailDelivery; signInPageUrl: string }> {
  const application = await requirePendingApplication(id);
  const { firmId, firmName } = await db.transaction(async (tx) => {
    let firm: { id: number; name: string };
    if (approval.kind === "new") {
      const [result] = await tx.insert(tradeFirms).values(firmColumns(approval));
      firm = { id: result.insertId, name: approval.name };
    } else {
      const [existing] = await tx
        .select({ id: tradeFirms.id, name: tradeFirms.name, isActive: tradeFirms.isActive })
        .from(tradeFirms)
        .where(eq(tradeFirms.id, approval.firmId))
        .limit(1);
      if (!existing) throw new TradeAdminError(404, "That firm no longer exists.");
      if (!existing.isActive) {
        throw new TradeAdminError(409, `${existing.name} is retired. Make it active first, then approve.`);
      }
      firm = existing;
    }

    const [member] = await tx
      .select({ firmId: tradeMembers.firmId, firmName: tradeFirms.name })
      .from(tradeMembers)
      .innerJoin(tradeFirms, eq(tradeMembers.firmId, tradeFirms.id))
      .where(eq(tradeMembers.email, application.email))
      .limit(1);
    if (member && member.firmId !== firm.id) {
      throw new TradeAdminError(
        409,
        `${application.email} is already on ${member.firmName}. Remove them there first, or approve them onto it.`,
      );
    }
    if (!member) {
      try {
        await tx.insert(tradeMembers).values({ firmId: firm.id, email: application.email, name: application.contactName });
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          throw new TradeAdminError(409, `${application.email} was just added to a firm. Reload and check.`);
        }
        throw error;
      }
    }

    const [moved] = await tx
      .update(tradeApplications)
      .set({ status: "approved", firmId: firm.id, decidedBy, decidedAt: new Date() })
      .where(and(eq(tradeApplications.id, id), eq(tradeApplications.status, "pending")));
    if (moved.affectedRows === 0) throw new TradeAdminError(409, "Someone has just decided this application.");
    return { firmId: firm.id, firmName: firm.name };
  });

  const signInPageUrl = accountSignInPageUrl(origin, application.email);
  let delivery: ReadyEmailDelivery = "not-configured";
  if (isEmailConfigured()) {
    try {
      await sendEmail({ to: application.email, ...tradeAccountReadyEmail({ firmName, signInPageUrl }) });
      delivery = "sent";
    } catch (error) {
      console.error("Trade account ready email failed", error);
      delivery = "failed";
    }
  }
  return { firmId, firmName, email: application.email, delivery, signInPageUrl };
}

/** Decline an application. Nothing is sent to the applicant: a refusal is better made by phone. */
export async function declineTradeApplication(id: string, note: string | null, decidedBy: string): Promise<void> {
  await requirePendingApplication(id);
  const [moved] = await db
    .update(tradeApplications)
    .set({ status: "declined", decisionNote: note, decidedBy, decidedAt: new Date() })
    .where(and(eq(tradeApplications.id, id), eq(tradeApplications.status, "pending")));
  if (moved.affectedRows === 0) throw new TradeAdminError(409, "Someone has just decided this application.");
}
