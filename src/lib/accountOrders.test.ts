import { describe, expect, it } from "vitest";
import {
  ORDER_PROGRESS_STEPS,
  changedWhen,
  itemsSummary,
  orderHeadline,
  orderTitle,
  progressState,
  serviceDateText,
  splitLeadOrder,
} from "@/lib/accountOrders";
import { orderStatusValues } from "@/db/schema/orders";

const states = (status: Parameters<typeof progressState>[1]) =>
  ORDER_PROGRESS_STEPS.map((_, index) => progressState(index, status));

describe("progressState", () => {
  it("shows Ordered done as soon as it's paid, and the step the order is on as current", () => {
    expect(states("awaiting_print")).toEqual(["done", "todo", "todo", "todo"]);
    expect(states("in_production")).toEqual(["done", "current", "todo", "todo"]);
    expect(states("shipped")).toEqual(["done", "done", "current", "todo"]);
    expect(states("delivered")).toEqual(["done", "done", "done", "done"]);
  });

  it("has no proof step to wait on", () => {
    expect(ORDER_PROGRESS_STEPS).not.toContain("Proof ready");
  });
});

describe("splitLeadOrder", () => {
  it("leads with the newest order still on its way and keeps the rest in order", () => {
    const orders = [
      { id: "a", status: "delivered" as const },
      { id: "b", status: "in_production" as const },
      { id: "c", status: "awaiting_print" as const },
    ];
    const { lead, rest } = splitLeadOrder(orders);
    expect(lead?.id).toBe("b");
    expect(rest.map((order) => order.id)).toEqual(["a", "c"]);
  });

  it("has no lead when nothing is on its way", () => {
    expect(splitLeadOrder([{ status: "delivered" as const }, { status: "cancelled" as const }]).lead).toBeNull();
  });
});

describe("orderHeadline", () => {
  it("has wording for every status a placed order can have", () => {
    for (const status of orderStatusValues) {
      expect(orderHeadline(status).title).not.toBe("");
    }
    expect(orderHeadline("shipped").label).toBe("On its way");
  });
});

describe("order wording", () => {
  const lines = [
    { productLabel: "Order of Service Booklets", copies: 50 },
    { productLabel: "Memorial Cards", copies: 1 },
  ];

  it("summarises every line for the trade table", () => {
    expect(itemsSummary(lines)).toBe("Order of Service Booklets ×50, Memorial Cards ×1");
  });

  it("titles one line with its copies, and several by the first", () => {
    expect(orderTitle(lines.slice(0, 1))).toBe("Order of Service Booklets · 50 copies");
    expect(orderTitle(lines)).toBe("Order of Service Booklets and 1 more");
    expect(orderTitle([])).toBe("Your order");
  });

  it("writes the service date long or short", () => {
    expect(serviceDateText("2026-10-16")).toBe("Friday 16 October");
    expect(serviceDateText("2026-10-14", "short")).toBe("Wed 14 Oct");
  });
});

describe("changedWhen", () => {
  const now = new Date("2026-10-13T10:00:00Z");

  it("counts the shop's calendar days", () => {
    expect(changedWhen(new Date("2026-10-13T06:00:00Z"), now)).toBe("today");
    // 23:30 UTC on the 12th is already the 13th in London.
    expect(changedWhen(new Date("2026-10-12T23:30:00Z"), now)).toBe("today");
    expect(changedWhen(new Date("2026-10-12T09:00:00Z"), now)).toBe("yesterday");
    expect(changedWhen(new Date("2026-10-10T09:00:00Z"), now)).toBe("3 days ago");
    expect(changedWhen(new Date("2026-09-20T09:00:00Z"), now)).toBe("on 20 September");
  });
});
