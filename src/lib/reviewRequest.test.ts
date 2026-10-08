import { describe, expect, it } from "vitest";

import {
  readReviewOptOutToken,
  reviewOptOutToken,
  reviewRequestDecision,
  reviewRequestDueOn,
  type ReviewRequestFacts,
} from "@/lib/reviewRequest";

const facts = (overrides: Partial<ReviewRequestFacts> = {}): ReviewRequestFacts => ({
  status: "delivered",
  optOut: false,
  emailOptedOut: false,
  contactEmail: "family@example.com",
  requestedAt: null,
  refunded: false,
  completedOn: "2026-10-05",
  serviceDates: ["2026-10-09"],
  ...overrides,
});

describe("reviewRequestDueOn", () => {
  it("is two weeks after the funeral", () => {
    expect(reviewRequestDueOn("2026-10-05", ["2026-10-09"])).toBe("2026-10-23");
  });

  it("is three weeks after completion when no funeral date was given", () => {
    expect(reviewRequestDueOn("2026-10-05", [null])).toBe("2026-10-26");
    expect(reviewRequestDueOn("2026-10-05", [])).toBe("2026-10-26");
  });

  it("runs from the latest funeral date on the order", () => {
    expect(reviewRequestDueOn("2026-10-05", ["2026-10-09", null, "2026-10-12"])).toBe("2026-10-26");
  });

  it("is never before the job is completed", () => {
    // Closed in Thintent a month after the funeral: due at once, not missed.
    expect(reviewRequestDueOn("2026-11-20", ["2026-10-09"])).toBe("2026-11-20");
  });
});

describe("reviewRequestDecision", () => {
  it("waits until it is due, then sends", () => {
    expect(reviewRequestDecision(facts(), "2026-10-22")).toEqual({ action: "wait", dueOn: "2026-10-23" });
    expect(reviewRequestDecision(facts(), "2026-10-23")).toEqual({ action: "send", dueOn: "2026-10-23" });
  });

  it("stays sendable for two weeks, then gives up rather than writing late", () => {
    expect(reviewRequestDecision(facts(), "2026-11-06").action).toBe("send");
    expect(reviewRequestDecision(facts(), "2026-11-07")).toEqual({ action: "skip", reason: "too late" });
  });

  it("only asks about a completed order", () => {
    for (const status of ["awaiting_print", "in_production", "shipped", "cancelled", "refunded"]) {
      expect(reviewRequestDecision(facts({ status }), "2026-10-23").action).toBe("skip");
    }
  });

  it("never sends twice", () => {
    expect(reviewRequestDecision(facts({ requestedAt: new Date() }), "2026-10-23")).toEqual({
      action: "skip",
      reason: "already sent",
    });
  });

  it("needs an explicit yes at checkout — an order from before the question is never asked", () => {
    expect(reviewRequestDecision(facts({ optOut: true }), "2026-10-23")).toEqual({
      action: "skip",
      reason: "opted out at checkout",
    });
    expect(reviewRequestDecision(facts({ optOut: null }), "2026-10-23")).toEqual({
      action: "skip",
      reason: "not asked at checkout",
    });
  });

  it("respects an address that unsubscribed, and an order with any refund", () => {
    expect(reviewRequestDecision(facts({ emailOptedOut: true }), "2026-10-23").action).toBe("skip");
    expect(reviewRequestDecision(facts({ refunded: true }), "2026-10-23")).toEqual({
      action: "skip",
      reason: "refunded",
    });
    expect(reviewRequestDecision(facts({ contactEmail: null }), "2026-10-23").action).toBe("skip");
  });
});

describe("review opt-out token", () => {
  const secret = "test-secret";

  it("round-trips the lowercased address", () => {
    const token = reviewOptOutToken(" Family@Example.com ", secret);
    expect(readReviewOptOutToken(token, secret)).toBe("family@example.com");
  });

  it("refuses a token signed with another secret, or for another address", () => {
    const token = reviewOptOutToken("family@example.com", secret);
    expect(readReviewOptOutToken(token, "other-secret")).toBeNull();
    const [, signature] = token.split(".");
    const forged = `${Buffer.from("someone@example.com").toString("base64url")}.${signature}`;
    expect(readReviewOptOutToken(forged, secret)).toBeNull();
  });

  it("refuses anything malformed", () => {
    for (const bad of [undefined, 42, "", "abc", "a.b.c", ".sig", `${"x".repeat(2000)}.y`]) {
      expect(readReviewOptOutToken(bad, secret)).toBeNull();
    }
  });
});
