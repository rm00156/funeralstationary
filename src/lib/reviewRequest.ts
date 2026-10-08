/**
 * The one email asking a family how we did — when it goes, and the signed
 * link that stops it. Pure (no DB, no mail client) so it unit-tests;
 * reviewRequests.server.ts gathers the facts and sends.
 *
 * Timing follows funeral-sector practice rather than shop practice: not
 * before the service and not in the week after it, but at the start of the
 * third week. The booklets are used *at* the funeral, so the clock runs from
 * the funeral date the customer gave at checkout, not from delivery.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

import { addDays } from "@/lib/adminDashboard";

/** Days after the funeral the request goes. */
export const REVIEW_REQUEST_DAYS_AFTER_SERVICE = 14;
/**
 * Days after the job is completed, when no funeral date was given. Delivery
 * usually comes a few days before the funeral, so this lands at about the
 * same point.
 */
export const REVIEW_REQUEST_DAYS_AFTER_COMPLETION = 21;
/**
 * How long a due request stays sendable. Past this a late email is worse
 * than none — it keeps a missed run, or orders completed long before this
 * shipped, from writing to someone months on.
 */
export const REVIEW_REQUEST_WINDOW_DAYS = 14;

export interface ReviewRequestFacts {
  /** The order's status now; only a delivered (completed) order is asked. */
  status: string;
  /** The checkout tick: null = never asked, which counts as no. */
  optOut: boolean | null;
  /** The address asked never to be sent another (review_request_opt_outs). */
  emailOptedOut: boolean;
  contactEmail: string | null;
  /** Already sent (or being sent) — never twice. */
  requestedAt: Date | null;
  /** Any succeeded refund, even part of one: something went wrong. */
  refunded: boolean;
  /** Shop day (YYYY-MM-DD) the order was marked delivered/completed. */
  completedOn: string;
  /** The funeral dates on its lines (checkout writes the same one on every line). */
  serviceDates: readonly (string | null)[];
}

export type ReviewRequestDecision =
  | { action: "send"; dueOn: string }
  | { action: "wait"; dueOn: string }
  | { action: "skip"; reason: string };

/** The shop day the request falls due. Never before the job is completed. */
export function reviewRequestDueOn(completedOn: string, serviceDates: readonly (string | null)[]): string {
  const latestService = serviceDates.filter((date): date is string => !!date).sort().at(-1);
  if (!latestService) return addDays(completedOn, REVIEW_REQUEST_DAYS_AFTER_COMPLETION);
  const afterService = addDays(latestService, REVIEW_REQUEST_DAYS_AFTER_SERVICE);
  // A job closed in Thintent after that point goes at the next run, not never.
  return afterService < completedOn ? completedOn : afterService;
}

/** Whether to send today (`today` is the shop's YYYY-MM-DD). */
export function reviewRequestDecision(facts: ReviewRequestFacts, today: string): ReviewRequestDecision {
  if (facts.status !== "delivered") return { action: "skip", reason: `order is ${facts.status}` };
  if (facts.requestedAt) return { action: "skip", reason: "already sent" };
  if (facts.optOut !== false) {
    return { action: "skip", reason: facts.optOut ? "opted out at checkout" : "not asked at checkout" };
  }
  if (!facts.contactEmail) return { action: "skip", reason: "no email address" };
  if (facts.emailOptedOut) return { action: "skip", reason: "address opted out" };
  if (facts.refunded) return { action: "skip", reason: "refunded" };

  const dueOn = reviewRequestDueOn(facts.completedOn, facts.serviceDates);
  if (today < dueOn) return { action: "wait", dueOn };
  if (today > addDays(dueOn, REVIEW_REQUEST_WINDOW_DAYS)) return { action: "skip", reason: "too late" };
  return { action: "send", dueOn };
}

/*
 * The unsubscribe link carries the address and an HMAC of it, so it needs
 * no table of tokens and never expires — an unsubscribe link must keep
 * working however late it is clicked. The purpose prefix keeps the
 * signature from being reusable anywhere else AUTH_SECRET signs.
 */
const sign = (email: string, secret: string) =>
  createHmac("sha256", secret).update(`review-opt-out:${email}`).digest("base64url");

export function reviewOptOutToken(email: string, secret: string): string {
  const normalised = email.trim().toLowerCase();
  return `${Buffer.from(normalised).toString("base64url")}.${sign(normalised, secret)}`;
}

/** The address a token was made for, or null when it isn't one of ours. */
export function readReviewOptOutToken(token: unknown, secret: string): string | null {
  if (typeof token !== "string" || token.length > 1024) return null;
  const [encoded, signature, ...rest] = token.split(".");
  if (!encoded || !signature || rest.length) return null;
  const email = Buffer.from(encoded, "base64url").toString("utf8");
  if (!email.includes("@") || email !== email.trim().toLowerCase()) return null;
  const expected = Buffer.from(sign(email, secret));
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected) ? email : null;
}
