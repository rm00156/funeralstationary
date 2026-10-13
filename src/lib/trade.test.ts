import { describe, expect, it } from "vitest";
import { getQuote, type PricingData } from "@/lib/orderOfServicePricing";
import {
  MAX_PAYMENT_TERMS_DAYS,
  filterTradeOrders,
  greeting,
  accountBalance,
  invoiceStatusText,
  isTradeApplicationId,
  parseDiscountPercent,
  resolvePayWith,
  tradeDiscountText,
  withTradeDiscount,
  longShopDate,
  parseDecisionNote,
  parseTradeApproval,
  parseTradeFirmInput,
  parseTradeId,
  parseTradeMemberInput,
  parseTradeOrderDetails,
  tradeTabCounts,
  tradeTabOf,
} from "@/lib/trade";

describe("parseTradeFirmInput", () => {
  it("trims the name and takes terms as a number or a typed string", () => {
    expect(parseTradeFirmInput({ name: "  Hollis &  Co ", paymentTermsDays: "30" })).toEqual({
      ok: true,
      value: { name: "Hollis & Co", paymentTermsDays: 30, discountPercent: 0, onAccount: false, accountsEmail: null },
    });
    expect(parseTradeFirmInput({ name: "Hollis", paymentTermsDays: 14 })).toMatchObject({
      ok: true,
      value: { name: "Hollis", paymentTermsDays: 14 },
    });
  });

  it("treats blank terms as not agreed yet", () => {
    for (const paymentTermsDays of [undefined, null, ""]) {
      const result = parseTradeFirmInput({ name: "Hollis", paymentTermsDays });
      expect(result.ok && result.value.paymentTermsDays).toBeNull();
    }
  });

  it("refuses a missing name and terms that aren't whole days in range", () => {
    expect(parseTradeFirmInput({ name: " " }).ok).toBe(false);
    for (const paymentTermsDays of [-1, 2.5, "thirty", MAX_PAYMENT_TERMS_DAYS + 1]) {
      expect(parseTradeFirmInput({ name: "Hollis", paymentTermsDays }).ok).toBe(false);
    }
    expect(parseTradeFirmInput({ name: "Hollis", paymentTermsDays: 0 }).ok).toBe(true);
  });
});

describe("parseTradeMemberInput", () => {
  it("lowercases the email, as users.email is, so detection matches the signed-in address", () => {
    expect(parseTradeMemberInput({ email: " Sam@Hollis.Example ", name: "" })).toEqual({
      ok: true,
      value: { email: "sam@hollis.example", name: null },
    });
  });

  it("refuses a malformed email", () => {
    expect(parseTradeMemberInput({ email: "sam@" }).ok).toBe(false);
  });
});

describe("parseTradeOrderDetails", () => {
  it("requires the family's name and keeps the reference optional", () => {
    expect(parseTradeOrderDetails({ familyName: " Harper  family ", customerRef: "" })).toEqual({
      ok: true,
      value: { familyName: "Harper family", customerRef: null },
    });
    expect(parseTradeOrderDetails({ familyName: "", customerRef: "HAR-1" }).ok).toBe(false);
    expect(parseTradeOrderDetails({ familyName: "Harper", customerRef: "x".repeat(61) }).ok).toBe(false);
  });
});

describe("parseTradeId", () => {
  it("accepts a positive whole number only", () => {
    expect(parseTradeId("12")).toBe(12);
    for (const segment of ["0", "-1", "1.5", "012", "abc", "99999999999"]) {
      expect(parseTradeId(segment)).toBeNull();
    }
  });
});

describe("greeting and longShopDate", () => {
  it("read the shop's clock, not the server's", () => {
    // 23:30 UTC on 12 October is 00:30 on the 13th in London (BST).
    const lateUtc = new Date("2026-10-12T23:30:00Z");
    expect(longShopDate(lateUtc)).toBe("Tuesday 13 October");
    expect(greeting(lateUtc)).toBe("Good morning");
    expect(greeting(new Date("2026-10-12T12:30:00Z"))).toBe("Good afternoon");
    expect(greeting(new Date("2026-12-12T18:30:00Z"))).toBe("Good evening");
  });
});

const orders = [
  { status: "awaiting_print", orderNumber: "TFS-2026-100001", familyName: "Harper family", customerRef: "HAR-1021" },
  { status: "shipped", orderNumber: "TFS-2026-100002", familyName: "Osei family", customerRef: null },
  { status: "delivered", orderNumber: "TFS-2026-100003", familyName: "Barnes family", customerRef: "BAR-1015" },
  { status: "cancelled", orderNumber: "TFS-2026-100004", familyName: null, customerRef: null },
] as const;

describe("trade order tabs", () => {
  it("files open orders as in progress, delivered as delivered, and the rest under All only", () => {
    expect(tradeTabOf("awaiting_print")).toBe("in-progress");
    expect(tradeTabOf("in_production")).toBe("in-progress");
    expect(tradeTabOf("shipped")).toBe("in-progress");
    expect(tradeTabOf("delivered")).toBe("delivered");
    expect(tradeTabOf("cancelled")).toBeNull();
    expect(tradeTabCounts(orders)).toEqual({ all: 4, "in-progress": 2, delivered: 1 });
  });

  it("filters by tab", () => {
    expect(filterTradeOrders(orders, "in-progress", "").map((o) => o.orderNumber)).toEqual([
      "TFS-2026-100001",
      "TFS-2026-100002",
    ]);
  });

  it("searches family, reference and order number, ignoring case and spacing", () => {
    expect(filterTradeOrders(orders, "all", "  harper ").map((o) => o.familyName)).toEqual(["Harper family"]);
    expect(filterTradeOrders(orders, "all", "bar-1015").map((o) => o.familyName)).toEqual(["Barnes family"]);
    expect(filterTradeOrders(orders, "all", "100004")).toHaveLength(1);
    expect(filterTradeOrders(orders, "delivered", "harper")).toEqual([]);
  });
});

describe("parseTradeApproval", () => {
  it("takes a new firm with its name and terms", () => {
    expect(parseTradeApproval({ kind: "new", name: " Hollis ", paymentTermsDays: "30", discountPercent: "10" })).toEqual({
      ok: true,
      value: { kind: "new", name: "Hollis", paymentTermsDays: 30, discountPercent: 10, onAccount: false, accountsEmail: null },
    });
    expect(parseTradeApproval({ kind: "new", name: "" }).ok).toBe(false);
  });

  it("takes an existing firm by id, as a number or a string", () => {
    expect(parseTradeApproval({ kind: "existing", firmId: 4 })).toEqual({ ok: true, value: { kind: "existing", firmId: 4 } });
    expect(parseTradeApproval({ kind: "existing", firmId: "4" })).toEqual({ ok: true, value: { kind: "existing", firmId: 4 } });
    expect(parseTradeApproval({ kind: "existing", firmId: 0 }).ok).toBe(false);
    expect(parseTradeApproval({ kind: "existing" }).ok).toBe(false);
  });

  it("refuses anything else", () => {
    expect(parseTradeApproval({ kind: "both" }).ok).toBe(false);
    expect(parseTradeApproval(null).ok).toBe(false);
  });
});

describe("parseDecisionNote", () => {
  it("keeps a note, treats blank as none, and caps its length", () => {
    expect(parseDecisionNote("  Not a funeral director ")).toEqual({ ok: true, value: "Not a funeral director" });
    expect(parseDecisionNote("  ")).toEqual({ ok: true, value: null });
    expect(parseDecisionNote(undefined)).toEqual({ ok: true, value: null });
    expect(parseDecisionNote("x".repeat(2001)).ok).toBe(false);
  });
});

describe("isTradeApplicationId", () => {
  it("accepts a UUID only", () => {
    expect(isTradeApplicationId("3f2b8c1e-9d4a-4b7e-8a61-2c5d9e0f1a2b")).toBe(true);
    expect(isTradeApplicationId("12")).toBe(false);
    expect(isTradeApplicationId("3f2b8c1e-9d4a-4b7e-8a61-2c5d9e0f1a2b' OR 1=1")).toBe(false);
  });
});

describe("trade discount and account settings", () => {
  it("reads a discount as a percentage with up to two decimals, blank as none", () => {
    expect(parseDiscountPercent("")).toEqual({ ok: true, value: 0 });
    expect(parseDiscountPercent("10")).toEqual({ ok: true, value: 10 });
    expect(parseDiscountPercent("12.5%")).toEqual({ ok: true, value: 12.5 });
    expect(parseDiscountPercent(7.25)).toEqual({ ok: true, value: 7.25 });
    for (const bad of ["-5", "12.345", "51", "ten"]) expect(parseDiscountPercent(bad).ok).toBe(false);
  });

  it("allows on account only with terms, and lowercases the accounts email", () => {
    expect(parseTradeFirmInput({ name: "Hollis", onAccount: true }).ok).toBe(false);
    expect(
      parseTradeFirmInput({ name: "Hollis", paymentTermsDays: 30, onAccount: true, accountsEmail: " Accounts@Hollis.Example " }),
    ).toMatchObject({ ok: true, value: { onAccount: true, accountsEmail: "accounts@hollis.example" } });
    expect(parseTradeFirmInput({ name: "Hollis", accountsEmail: "accounts@" }).ok).toBe(false);
  });

  it("writes a discount the way the customer reads it", () => {
    expect(tradeDiscountText(10)).toBe("10% off");
    expect(tradeDiscountText(12.5)).toBe("12.5% off");
  });
});

describe("withTradeDiscount", () => {
  const data: PricingData = {
    quantity: [{ id: "50", label: "50 copies", multiplier: 0.9, value: 50 }],
    pages: [{ id: "8", label: "8 pages", pages: 8, baseRatePence: 333 }],
    paper: [{ id: "silk", label: "Silk", multiplier: 1.1 }],
    delivery: [{ id: "std", label: "Standard", pricePence: 495, note: "" }],
  };
  const selection = { quantity: "50", pages: "8", paper: "silk", delivery: "std" };

  it("takes the discount off the print price, rounding once, and leaves delivery alone", () => {
    const list = getQuote(data, selection);
    const trade = getQuote(withTradeDiscount(data, 10), selection);
    expect(list.unitPricePence).toBe(330); // round(333 × 1.1 × 0.9)
    expect(trade.unitPricePence).toBe(297); // round(333 × 0.9 × 1.1 × 0.9), not round(330 × 0.9) twice
    expect(trade.printCostPence).toBe(297 * 50);
    expect(trade.delivery.pricePence).toBe(495);
  });

  it("returns the same table when there's no discount", () => {
    expect(withTradeDiscount(data, 0)).toBe(data);
  });
});

describe("resolvePayWith", () => {
  it("pays by card unless account is asked for, and only a firm on account may", () => {
    const firm = { firmName: "Hope & Sons", paymentTermsDays: 30, accountsEmail: "accounts@hope.example", onAccount: true };
    const card = { ok: true, value: { payWith: "card" } };
    expect(resolvePayWith(undefined, null)).toEqual(card);
    expect(resolvePayWith("card", firm)).toEqual(card);
    expect(resolvePayWith("account", firm)).toEqual({
      ok: true,
      value: {
        payWith: "account",
        terms: { firmName: "Hope & Sons", paymentTermsDays: 30, accountsEmail: "accounts@hope.example" },
      },
    });
    expect(resolvePayWith("account", { ...firm, onAccount: false }).ok).toBe(false);
    expect(resolvePayWith("account", { ...firm, paymentTermsDays: null }).ok).toBe(false);
    expect(resolvePayWith("account", null).ok).toBe(false);
    expect(resolvePayWith("cheque", firm).ok).toBe(false);
  });
});

describe("the account balance and invoice wording", () => {
  const today = "2026-11-10";
  const account = (status: string | null, dueDate: string | null, paidPence = 0, extra = {}) => ({
    status: "awaiting_print" as const,
    paymentMethod: "account" as const,
    totalPence: 10_000,
    invoice: { status, dueDate, paidPence },
    ...extra,
  });

  it("owes every unpaid account order, part payments taken off, and flags the overdue", () => {
    const balance = accountBalance(
      [
        account("issued", "2026-11-20"),
        account("issued", "2026-11-01"),
        account("partially_paid", "2026-11-05", 4000),
        account("paid", "2026-10-01", 10_000),
        account("issued", "2026-10-01", 0, { status: "cancelled" }),
        account(null, null),
        { status: "delivered" as const, paymentMethod: "card" as const, totalPence: 5000, invoice: null },
      ],
      today,
    );
    expect(balance).toEqual({ owedPence: 10_000 + 10_000 + 6000 + 10_000, overduePence: 16_000, overdueCount: 2 });
  });

  it("says where each invoice stands", () => {
    expect(invoiceStatusText(account(null, null), today)).toBe("Invoice on its way");
    expect(invoiceStatusText(account("issued", "2026-11-20"), today)).toBe("Due 20 Nov");
    expect(invoiceStatusText(account("issued", "2026-11-01"), today)).toBe("Overdue · was due 1 Nov");
    expect(invoiceStatusText(account("partially_paid", "2026-11-20", 4000), today)).toBe("Part paid · due 20 Nov");
    expect(invoiceStatusText(account("paid", "2026-11-01", 10_000), today)).toBe("Paid");
    expect(invoiceStatusText(account("voided", null), today)).toBe("Cancelled");
  });
});
