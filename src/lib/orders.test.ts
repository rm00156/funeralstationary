import { describe, expect, it } from "vitest";

import {
  ORDER_NUMBER_RE,
  ORDER_STATUSES,
  ORDER_STATUS_TRANSITIONS,
  buildStripeLineItems,
  allProofsApproved,
  canReviewProof,
  canTransition,
  computeOrderTotals,
  latestVisibleProof,
  parseProofDecision,
  makeOrderNumber,
  parseOrderStatus,
  resolveSelectionStrict,
  sumLineItems,
  vatFromInclusive,
  vatRateToDecimalString,
} from "@/lib/orders";
import type { PricingData } from "@/lib/orderOfServicePricing";

const pricing: PricingData = {
  quantity: [
    { id: "q15", label: "15", multiplier: 1, value: 15 },
    { id: "q50", label: "50", multiplier: 0.9, value: 50 },
  ],
  size: [{ id: "a5", label: "A5", multiplier: 1 }],
  colour: [{ id: "colour", label: "Full colour", multiplier: 1 }],
  pages: [{ id: "p8", label: "8 pages", pages: 8, baseRatePence: 200 }],
  paper: [{ id: "silk", label: "Silk", multiplier: 1 }],
  delivery: [{ id: "standard", label: "Standard", pricePence: 0, note: "" }],
};

describe("status machine", () => {
  it("allows the documented forward path", () => {
    expect(canTransition("awaiting_proof", "proof_sent")).toBe(true);
    expect(canTransition("proof_sent", "approved")).toBe(true);
    expect(canTransition("approved", "in_production")).toBe(true);
    expect(canTransition("in_production", "shipped")).toBe(true);
    expect(canTransition("shipped", "delivered")).toBe(true);
  });

  it("rejects skipping steps and leaving terminal states", () => {
    expect(canTransition("awaiting_proof", "delivered")).toBe(false);
    expect(canTransition("refunded", "draft")).toBe(false);
    expect(canTransition("draft", "awaiting_proof")).toBe(false); // only payment does this
  });

  it("covers every status exactly once and only points at real statuses", () => {
    expect(Object.keys(ORDER_STATUS_TRANSITIONS).sort()).toEqual([...ORDER_STATUSES].sort());
    for (const targets of Object.values(ORDER_STATUS_TRANSITIONS)) {
      for (const target of targets) expect(ORDER_STATUSES).toContain(target);
    }
  });

  it("parses statuses strictly", () => {
    expect(parseOrderStatus("shipped")).toBe("shipped");
    expect(parseOrderStatus("SHIPPED")).toBeNull();
    expect(parseOrderStatus(3)).toBeNull();
  });
});

describe("VAT and totals", () => {
  it("backs VAT out of an inclusive amount", () => {
    expect(vatFromInclusive(12000)).toBe(2000);
    expect(vatFromInclusive(10000)).toBe(1667);
    expect(vatFromInclusive(0)).toBe(0);
    expect(vatFromInclusive(10000, 0)).toBe(0);
  });

  it("formats the rate the way the decimal column expects", () => {
    expect(vatRateToDecimalString(0.2)).toBe("0.2000");
    expect(vatRateToDecimalString(0.05)).toBe("0.0500");
  });

  it("sums lines, adds delivery and backs out VAT of the total", () => {
    expect(computeOrderTotals([3000, 1500], 499)).toEqual({
      subtotalPence: 4500,
      deliveryPence: 499,
      totalPence: 4999,
      vatPence: vatFromInclusive(4999),
      vatRate: 0.2,
    });
    expect(computeOrderTotals([], 0).totalPence).toBe(0);
  });
});

describe("resolveSelectionStrict", () => {
  const selection = {
    quantity: "q50",
    size: "a5",
    colour: "colour",
    pages: "p8",
    paper: "silk",
    delivery: "standard",
  };

  it("prices a fully valid selection", () => {
    const result = resolveSelectionStrict(pricing, selection);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.quote.unitPricePence).toBe(180);
      expect(result.quote.printCostPence).toBe(9000);
    }
  });

  it("names every unknown axis instead of silently falling back", () => {
    const result = resolveSelectionStrict(pricing, {
      ...selection,
      quantity: "q999",
      paper: "gone",
    });
    expect(result).toEqual({ ok: false, invalid: ["quantity", "paper"] });
  });
});

describe("makeOrderNumber", () => {
  it("is TFS-<year>-<6 digits>, zero padded", () => {
    expect(makeOrderNumber(2026, () => 0)).toBe("TFS-2026-000000");
    expect(makeOrderNumber(2026, () => 0.999999)).toBe("TFS-2026-999999");
    expect(makeOrderNumber(2026, () => 0.0421)).toBe("TFS-2026-042100");
    expect(makeOrderNumber(2026)).toMatch(ORDER_NUMBER_RE);
  });
});

describe("buildStripeLineItems", () => {
  const items = [
    { name: "Order of service — Whispering Petals", unitPricePence: 180, copies: 50 },
    { name: "Order of service — Second", unitPricePence: 250, copies: 15 },
  ];

  it("sums to the order total, delivery included", () => {
    const lines = buildStripeLineItems(items, { label: "Next day", pricePence: 999 });
    expect(lines).toHaveLength(3);
    expect(lines[2]).toEqual({ name: "Delivery — Next day", unitAmountPence: 999, quantity: 1 });
    expect(sumLineItems(lines)).toBe(computeOrderTotals([9000, 3750], 999).totalPence);
  });

  it("omits a free delivery line", () => {
    const lines = buildStripeLineItems(items, { label: "Standard", pricePence: 0 });
    expect(lines).toHaveLength(2);
    expect(sumLineItems(lines)).toBe(12750);
  });
});

describe("proof review", () => {
  const proof = (version: number, status: string) =>
    ({ version, status }) as { version: number; status: never };

  it("shows the highest version the customer has been sent", () => {
    const proofs = [proof(2, "sent"), proof(1, "approved")];
    expect(latestVisibleProof(proofs)?.version).toBe(2);
  });

  it("never shows a version that is still the admin's working copy", () => {
    // v3 has been rendered but not sent — the customer still sees v2.
    const proofs = [proof(3, "generated"), proof(2, "sent"), proof(1, "changes_requested")];
    expect(latestVisibleProof(proofs)?.version).toBe(2);
  });

  it("shows nothing when every version is unsent", () => {
    expect(latestVisibleProof([proof(1, "generated")])).toBeNull();
    expect(latestVisibleProof([])).toBeNull();
  });

  it("only lets a customer answer a proof that is awaiting them", () => {
    expect(canReviewProof("sent")).toBe(true);
    expect(canReviewProof("generated")).toBe(false);
    expect(canReviewProof("approved")).toBe(false);
    expect(canReviewProof("changes_requested")).toBe(false);
  });

  it("approves the order only when every line is approved", () => {
    const approved = { proofs: [proof(1, "approved")] };
    const outstanding = { proofs: [proof(1, "sent")] };
    expect(allProofsApproved([approved, approved])).toBe(true);
    expect(allProofsApproved([approved, outstanding])).toBe(false);
  });

  it("does not approve a line whose newest sent version is still outstanding", () => {
    // v1 was approved, then a change was made and v2 sent — not approved.
    expect(allProofsApproved([{ proofs: [proof(2, "sent"), proof(1, "approved")] }])).toBe(false);
  });

  it("does not approve an order with no lines", () => {
    expect(allProofsApproved([])).toBe(false);
  });

  it("rejects a decision that is not one of the two answers", () => {
    expect(parseProofDecision("approved")).toBe("approved");
    expect(parseProofDecision("changes_requested")).toBe("changes_requested");
    expect(parseProofDecision("sent")).toBeNull();
    expect(parseProofDecision(undefined)).toBeNull();
  });
});
