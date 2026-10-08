import { describe, expect, it } from "vitest";
import {
  actionItems,
  changeText,
  cutoffState,
  likeContains,
  mustGoOutToday,
  nextWorkingDay,
  parseCutoff,
  serviceUrgency,
  shopDate,
  shopDayStart,
  takingsSummary,
  weekStart,
  type DashboardLine,
  type DashboardOrder,
} from "./adminDashboard";

const line = (overrides: Partial<DashboardLine> = {}): DashboardLine => ({
  productLabel: "Order of Service",
  copies: 50,
  pagesLabel: "8 pages",
  source: "template",
  templateName: "Portrait Oval",
  canvaUrl: null,
  acceptedWarnings: [],
  missingProof: false,
  ...overrides,
});

const order = (overrides: Partial<DashboardOrder> = {}): DashboardOrder => ({
  id: "o1",
  orderNumber: "TFS-2026-000001",
  status: "awaiting_print",
  contactName: "S. Mitchell",
  contactEmail: "s@example.com",
  contactPhone: null,
  customerEmail: "s@example.com",
  paidAt: new Date("2026-10-08T06:00:00Z"),
  shippedAt: null,
  totalPence: 9000,
  refundedPence: 0,
  thintentJobRef: "J-1",
  serviceDate: null,
  lines: [line()],
  ...overrides,
});

// Thursday 8 October 2026, 08:00 in London (BST, UTC+1).
const THURSDAY = new Date("2026-10-08T07:00:00Z");

describe("shop dates", () => {
  it("works in London time, not UTC", () => {
    // 23:30 UTC on the 7th is already the 8th in BST.
    expect(shopDate(new Date("2026-10-07T23:30:00Z"))).toBe("2026-10-08");
    expect(shopDate(new Date("2026-12-07T23:30:00Z"))).toBe("2026-12-07");
  });

  it("starts a day at London midnight across clock changes", () => {
    expect(shopDayStart("2026-10-08").toISOString()).toBe("2026-10-07T23:00:00.000Z");
    expect(shopDayStart("2026-12-08").toISOString()).toBe("2026-12-08T00:00:00.000Z");
    // The clocks go back at 2am on 25 Oct 2026; midnight is still BST.
    expect(shopDayStart("2026-10-25").toISOString()).toBe("2026-10-24T23:00:00.000Z");
    expect(shopDayStart("2026-10-26").toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });

  it("skips the weekend for the next working day", () => {
    expect(nextWorkingDay("2026-10-08")).toBe("2026-10-09");
    expect(nextWorkingDay("2026-10-09")).toBe("2026-10-12");
    expect(nextWorkingDay("2026-10-10")).toBe("2026-10-12");
  });

  it("starts weeks on a Monday", () => {
    expect(weekStart("2026-10-08")).toBe("2026-10-05");
    expect(weekStart("2026-10-05")).toBe("2026-10-05");
    expect(weekStart("2026-10-11")).toBe("2026-10-05");
  });
});

describe("cut-off", () => {
  it("parses the site's wording", () => {
    expect(parseCutoff("10am")).toBe(600);
    expect(parseCutoff("11:30am")).toBe(690);
    expect(parseCutoff("2pm")).toBe(840);
    expect(parseCutoff("12pm")).toBe(720);
    expect(parseCutoff("noonish")).toBeNull();
  });

  it("counts down to the cut-off in London time", () => {
    expect(cutoffState(THURSDAY, "10am")).toEqual({ kind: "open", minutesLeft: 120 });
    expect(cutoffState(new Date("2026-10-08T09:30:00Z"), "10am")).toEqual({ kind: "passed" });
  });

  it("has no cut-off at the weekend", () => {
    expect(cutoffState(new Date("2026-10-10T07:00:00Z"), "10am")).toEqual({ kind: "closed" });
  });
});

describe("serviceUrgency", () => {
  it("is urgent when the service is by the next working day", () => {
    expect(serviceUrgency("2026-10-09", "2026-10-08")).toEqual({ label: "Service tomorrow", urgency: "now" });
    // Friday: a Monday service has to go today.
    expect(serviceUrgency("2026-10-12", "2026-10-09").urgency).toBe("now");
    expect(serviceUrgency("2026-10-12", "2026-10-08")).toEqual({ label: "Service Mon", urgency: "soon" });
    expect(serviceUrgency("2026-10-20", "2026-10-08")).toEqual({ label: "Service Tue 20 Oct", urgency: "later" });
    expect(serviceUrgency(null, "2026-10-08").urgency).toBe("none");
  });
});

describe("actionItems", () => {
  const ctx = { now: THURSDAY, thintentConfigured: true, storageConfigured: true };

  it("leaves a healthy order with a distant service alone", () => {
    expect(actionItems([order({ serviceDate: "2026-10-20" })], ctx)).toEqual([]);
  });

  it("asks for an urgent order to be printed", () => {
    const [item] = actionItems([order({ serviceDate: "2026-10-09" })], ctx);
    expect(item.action).toBe("Open order");
    expect(item.emphasis).toBe("primary");
    expect(item.chip.label).toBe("Service tomorrow");
  });

  it("sends a Canva line to the link", () => {
    const [item] = actionItems(
      [order({ lines: [line({ source: "canva", canvaUrl: "https://www.canva.com/design/x" })] })],
      ctx,
    );
    expect(item).toMatchObject({ action: "Open Canva link", href: "https://www.canva.com/design/x", external: true });
  });

  it("doesn't let a Canva link hide a missing Thintent job", () => {
    const [item] = actionItems(
      [order({ thintentJobRef: null, lines: [line({ source: "canva", canvaUrl: "https://canva.link/x" })] })],
      ctx,
    );
    expect(item.action).toBe("Send to Thintent");
  });

  it("stops asking about the file once the order is printing", () => {
    expect(
      actionItems(
        [order({ status: "in_production", lines: [line({ source: "canva", canvaUrl: "https://canva.link/x" })] })],
        ctx,
      ),
    ).toEqual([]);
  });

  it("only asks for a proof when storage could have made one", () => {
    const unproofed = order({ lines: [line({ missingProof: true })] });
    expect(actionItems([unproofed], ctx)[0].action).toBe("Regenerate proof");
    expect(actionItems([unproofed], { ...ctx, storageConfigured: false })).toEqual([]);
  });

  it("flags an order missing from Thintent only once fulfilment has had its chance", () => {
    const missing = order({ thintentJobRef: null });
    expect(actionItems([missing], ctx)[0].action).toBe("Send to Thintent");
    expect(actionItems([{ ...missing, paidAt: new Date(THURSDAY.getTime() - 60_000) }], ctx)).toEqual([]);
    expect(actionItems([missing], { ...ctx, thintentConfigured: false })).toEqual([]);
  });

  it("names the warnings a customer printed through", () => {
    const [item] = actionItems(
      [order({ lines: [line({ source: "pdf", acceptedWarnings: ["Photo on page 3 may print soft"] })] })],
      ctx,
    );
    expect(item.action).toBe("Review file");
    expect(item.message).toContain("Photo on page 3 may print soft");
  });

  it("asks about a refund on a paid cancellation until it is refunded in full", () => {
    expect(actionItems([order({ status: "cancelled" })], ctx)[0].action).toBe("Refund needed?");
    expect(actionItems([order({ status: "cancelled", refundedPence: 9000 })], ctx)).toEqual([]);
  });

  it("puts urgent rows first, then by service date", () => {
    const items = actionItems(
      [
        order({ id: "later", orderNumber: "B", thintentJobRef: null, serviceDate: "2026-10-20" }),
        order({ id: "urgent", orderNumber: "A", serviceDate: "2026-10-09" }),
      ],
      ctx,
    );
    expect(items.map((item) => item.orderId)).toEqual(["urgent", "later"]);
  });
});

describe("mustGoOutToday", () => {
  it("lists open orders due by the next working day, and those already sent today", () => {
    const rows = mustGoOutToday(
      [
        order({ id: "a", orderNumber: "A", serviceDate: "2026-10-09" }),
        order({ id: "b", orderNumber: "B", serviceDate: "2026-10-09", status: "shipped", shippedAt: THURSDAY }),
        order({ id: "c", orderNumber: "C", serviceDate: "2026-10-12" }),
        order({ id: "d", orderNumber: "D", serviceDate: null }),
        order({
          id: "e",
          orderNumber: "E",
          serviceDate: "2026-10-09",
          status: "shipped",
          shippedAt: new Date("2026-10-07T12:00:00Z"),
        }),
      ],
      THURSDAY,
    );
    expect(rows.map((row) => [row.orderId, row.sent])).toEqual([
      ["a", false],
      ["b", true],
    ]);
  });
});

describe("takingsSummary", () => {
  it("adds up payments net of refunds by shop day, week and month", () => {
    const summary = takingsSummary(
      [
        { paidAt: new Date("2026-10-08T06:00:00Z"), totalPence: 5000 }, // today
        { paidAt: new Date("2026-10-06T10:00:00Z"), totalPence: 3000 }, // this week
        { paidAt: new Date("2026-10-01T10:00:00Z"), totalPence: 2000 }, // this month, last week
        { paidAt: new Date("2026-09-03T10:00:00Z"), totalPence: 4000 }, // last month to date
        { paidAt: new Date("2026-09-20T10:00:00Z"), totalPence: 9000 }, // last month, later
      ],
      [{ refundedAt: new Date("2026-10-07T10:00:00Z"), amountPence: 1000 }],
      THURSDAY,
      4,
    );
    expect(summary.today).toEqual({ orders: 1, grossPence: 5000, refundedPence: 0, netPence: 5000 });
    expect(summary.week.netPence).toBe(7000);
    expect(summary.month).toEqual({ orders: 3, grossPence: 10000, refundedPence: 1000, netPence: 9000 });
    expect(summary.lastMonthToDate.netPence).toBe(4000);
    expect(summary.averageOrderPence).toBe(3333);
    expect(summary.weekly.map((week) => week.weekStart)).toEqual([
      "2026-09-14",
      "2026-09-21",
      "2026-09-28",
      "2026-10-05",
    ]);
    expect(summary.weekly.map((week) => week.netPence)).toEqual([9000, 0, 2000, 7000]);
  });

  it("compares the 31st with the whole of a shorter last month", () => {
    const summary = takingsSummary(
      [{ paidAt: new Date("2026-02-28T12:00:00Z"), totalPence: 100 }],
      [],
      new Date("2026-03-31T12:00:00Z"),
    );
    expect(summary.lastMonthToDate.netPence).toBe(100);
  });
});

describe("changeText", () => {
  it("reads as a rounded percentage", () => {
    expect(changeText(120, 100)).toBe("+20%");
    expect(changeText(92, 100)).toBe("−8%");
    expect(changeText(100, 100)).toBe("level");
    expect(changeText(100, 0)).toBeNull();
  });
});

describe("likeContains", () => {
  it("takes the user's wildcards literally", () => {
    expect(likeContains("50%_off")).toBe("%50\\%\\_off%");
    expect(likeContains("a\\b")).toBe("%a\\\\b%");
  });
});
