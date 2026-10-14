import { describe, expect, it } from "vitest";
import {
  addMonths,
  afterCutoff,
  biggestDrop,
  cancelledCount,
  niceCeiling,
  analyticsPeriod,
  bookletStats,
  designSources,
  funnelSteps,
  heatLevel,
  hourText,
  isQuiet,
  lastOrderText,
  lateReason,
  median,
  orderHeatmap,
  orderToDispatch,
  ordersByProduct,
  overviewHeadlines,
  parsePeriod,
  parseTradeSort,
  parseWorkingHours,
  percentText,
  periodText,
  repeatStats,
  SAME_DESIGN,
  serviceTimeliness,
  shopClock,
  sortTradeRows,
  stageTimes,
  takingsBetween,
  takingsByBucket,
  topTemplates,
  tradeAccountRows,
  tradeTrend,
  uploadWarnings,
  usualGapDays,
  workingMinutes,
  type AnalyticsLine,
  type AnalyticsOrder,
  type HistoryOrder,
  type ProductInfo,
} from "./adminAnalytics";

// Wednesday 14 October 2026, 12:00 in London (BST, UTC+1).
const NOW = new Date("2026-10-14T11:00:00Z");
const PERIOD = analyticsPeriod("12w", NOW);
const HOURS = { start: 9 * 60, end: 18 * 60 };

const line = (overrides: Partial<AnalyticsLine> = {}): AnalyticsLine => ({
  productSlug: "order-of-service",
  copies: 50,
  pagesLabel: "8 pages",
  pageCount: 8,
  source: "template",
  templateSlug: "portrait-oval",
  designId: "design-1",
  uploadWarnings: [],
  ...overrides,
});

let counter = 0;
const order = (overrides: Partial<AnalyticsOrder> = {}): AnalyticsOrder => {
  counter += 1;
  return {
    id: `order-${counter}`,
    orderNumber: `TFS-2026-${String(counter).padStart(6, "0")}`,
    status: "delivered",
    placedAt: new Date("2026-10-05T09:00:00Z"),
    paidAt: new Date("2026-10-05T09:00:00Z"),
    totalPence: 10_000,
    tradeFirmId: null,
    customer: `family${counter}@example.com`,
    serviceDate: null,
    pressAt: null,
    sentAt: null,
    deliveredAt: null,
    lines: [line()],
    ...overrides,
  };
};

const PRODUCTS = new Map<string, ProductInfo>([
  ["order-of-service", { slug: "order-of-service", label: "Order of Service", booklet: true }],
  ["bookmark", { slug: "bookmark", label: "Bookmarks", booklet: false }],
  ["memorial-card", { slug: "memorial-card", label: "Memorial cards", booklet: false }],
]);

describe("the period", () => {
  it("parses the period, defaulting to 12 weeks", () => {
    expect(parsePeriod("4w")).toBe("4w");
    expect(parsePeriod("12m")).toBe("12m");
    expect(parsePeriod("forever")).toBe("12w");
    expect(parsePeriod(undefined)).toBe("12w");
  });

  it("runs 12 whole weeks from a Monday up to today", () => {
    expect(PERIOD.buckets).toHaveLength(12);
    expect(PERIOD.from).toBe("2026-07-27");
    expect(PERIOD.buckets[0].label).toBe("27 Jul");
    expect(PERIOD.buckets.at(-1)?.start).toBe("2026-10-12");
    expect(PERIOD.to).toBe("2026-10-15");
    // The previous period is the same number of days just before.
    expect(PERIOD.previousFrom).toBe("2026-05-08");
  });

  it("runs 12 calendar months for 12m, across a year end", () => {
    const period = analyticsPeriod("12m", NOW);
    expect(period.from).toBe("2025-11-01");
    expect(period.buckets.map((bucket) => bucket.label)).toEqual([
      "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct",
    ]);
    expect(period.buckets[1].longLabel).toBe("December 2025");
    expect(period.buckets.at(-1)?.end).toBe("2026-11-01");
  });

  it("moves whole months", () => {
    expect(addMonths("2026-01-01", -1)).toBe("2025-12-01");
    expect(addMonths("2026-11-01", 2)).toBe("2027-01-01");
  });

  it("writes the range with the year once", () => {
    expect(periodText(PERIOD)).toBe("27 July – 14 October 2026");
    expect(periodText(analyticsPeriod("12m", NOW))).toBe("1 November 2025 – 14 October 2026");
  });
});

describe("helpers", () => {
  it("takes the median", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });

  it("writes a percentage, with decimals when asked", () => {
    expect(percentText(1, 0)).toBe("—");
    expect(percentText(1, 3)).toBe("33%");
    expect(percentText(393, 398, 1)).toBe("98.7%");
    expect(percentText(4, 4, 1)).toBe("100%");
  });
});

describe("takings", () => {
  it("splits families from trade and takes refunds off on the day they were made", () => {
    const orders = [
      order({ totalPence: 5_000 }),
      order({ totalPence: 3_000, tradeFirmId: 7 }),
      // Placed on account and not paid yet: no takings.
      order({ totalPence: 9_000, tradeFirmId: 7, paidAt: null }),
      // Paid before the period.
      order({ totalPence: 1_000, paidAt: new Date("2026-07-01T09:00:00Z") }),
    ];
    const refunds = [
      { refundedAt: new Date("2026-10-06T09:00:00Z"), amountPence: 500, tradeFirmId: null },
      { refundedAt: new Date("2026-10-06T09:00:00Z"), amountPence: 200, tradeFirmId: 7 },
    ];
    expect(takingsBetween(orders, refunds, PERIOD.from, PERIOD.to)).toEqual({
      familiesPence: 4_500,
      tradePence: 2_800,
      payments: 2,
    });
  });

  it("buckets the takings by week", () => {
    const buckets = takingsByBucket(
      [order({ paidAt: new Date("2026-10-13T09:00:00Z"), totalPence: 2_500 })],
      [],
      PERIOD,
    );
    expect(buckets.at(-1)).toMatchObject({ familiesPence: 2_500, payments: 1 });
    expect(buckets.at(-2)).toMatchObject({ familiesPence: 0, payments: 0 });
  });

  it("compares the headlines with the period before", () => {
    const before = new Date("2026-06-01T09:00:00Z");
    const headlines = overviewHeadlines(
      [
        order({ totalPence: 4_000 }),
        order({ totalPence: 2_000 }),
        order({ totalPence: 3_000, placedAt: before, paidAt: before }),
      ],
      [{ refundedAt: new Date("2026-10-06T09:00:00Z"), amountPence: 1_000, tradeFirmId: null }],
      PERIOD,
    );
    expect(headlines.takings).toEqual({ current: 5_000, previous: 3_000 });
    expect(headlines.orders).toEqual({ current: 2, previous: 1 });
    // Per payment, before refunds.
    expect(headlines.averageOrder).toEqual({ current: 3_000, previous: 3_000 });
  });
});

describe("keeping the promise", () => {
  it("counts an order in time when it was sent before the service day", () => {
    const result = serviceTimeliness(
      [
        order({ serviceDate: "2026-10-09", sentAt: new Date("2026-10-08T15:00:00Z") }),
        // Sent on the day of the service: late.
        order({ serviceDate: "2026-10-09", sentAt: new Date("2026-10-09T08:00:00Z") }),
        // Never sent and the service has been: late.
        order({ serviceDate: "2026-10-12", status: "awaiting_print" }),
        // Service still to come: not judged yet.
        order({ serviceDate: "2026-10-20", status: "awaiting_print" }),
        // Cancelled, or no service date: not judged.
        order({ serviceDate: "2026-10-09", status: "cancelled" }),
        order({ serviceDate: null }),
      ],
      PERIOD,
      NOW,
    );
    expect(result.total).toBe(3);
    expect(result.inTime).toBe(1);
    expect(result.late.map((late) => late.serviceDate)).toEqual(["2026-10-12", "2026-10-09"]);
  });

  it("says when an order came in too late to make it", () => {
    // Service Friday 9 Oct: it had to be in by 10am on Thursday 8 Oct.
    const late = { serviceDate: "2026-10-09", sentAt: new Date("2026-10-09T08:00:00Z") };
    expect(lateReason({ ...late, placedAt: new Date("2026-10-08T08:59:00Z") }, "10am")).toBe("Sent late");
    expect(lateReason({ ...late, placedAt: new Date("2026-10-08T09:30:00Z") }, "10am")).toBe(
      "Ordered too close to the service",
    );
    expect(lateReason({ ...late, sentAt: null, placedAt: new Date("2026-10-01T09:00:00Z") }, "10am")).toBe("Not sent");
    // A Monday service needed it by Friday's cut-off.
    expect(
      lateReason(
        { serviceDate: "2026-10-12", sentAt: null, placedAt: new Date("2026-10-10T09:00:00Z") },
        "10am",
      ),
    ).toBe("Ordered too close to the service");
  });
});

describe("what sells", () => {
  const orders = [
    order({ lines: [line(), line({ productSlug: "bookmark", templateSlug: "portrait-oval" })] }),
    order({ lines: [line({ templateSlug: "classic-cross" })] }),
    order({ lines: [line({ source: "pdf", templateSlug: null, designId: null })] }),
    order({ lines: [line({ source: "canva", templateSlug: null, designId: null, productSlug: "bookmark" })] }),
  ];

  it("counts orders containing each product once", () => {
    expect(ordersByProduct(orders, PERIOD)).toEqual([
      { key: "order-of-service", count: 3, share: 75 },
      { key: "bookmark", count: 2, share: 50 },
    ]);
  });

  it("counts lines by where the design came from", () => {
    expect(designSources(orders, PERIOD)).toEqual([
      { key: "template", count: 3, share: 60 },
      { key: "pdf", count: 1, share: 20 },
      { key: "canva", count: 1, share: 20 },
    ]);
  });

  it("ranks templates by the orders that printed them", () => {
    expect(topTemplates(orders, PERIOD)).toEqual([
      { key: "classic-cross", count: 1, share: 50 },
      { key: "portrait-oval", count: 1, share: 50 },
    ]);
  });

  it("works out how many carried on at each step", () => {
    expect(
      funnelSteps([
        { label: "Started", count: 200 },
        { label: "In a basket", count: 50 },
        { label: "Ordered", count: 40 },
      ]).map((step) => step.continued),
    ).toEqual([null, 25, 80]);
  });
});

describe("trade accounts", () => {
  const days = (...list: string[]) => list.map((day) => new Date(`${day}T10:00:00Z`));

  it("takes the median gap between orders, once there are three", () => {
    expect(usualGapDays(days("2026-09-01", "2026-09-10"))).toBeNull();
    expect(usualGapDays(days("2026-09-01", "2026-09-10", "2026-09-17", "2026-10-01"))).toBe(9);
  });

  it("calls a firm quiet after several of its usual gaps, and never before four weeks", () => {
    expect(isQuiet(49, 9)).toBe(true);
    expect(isQuiet(20, 4)).toBe(false);
    expect(isQuiet(28, 4)).toBe(true);
    expect(isQuiet(40, 16)).toBe(true);
    expect(isQuiet(39, 16)).toBe(false);
    expect(isQuiet(100, null)).toBe(false);
  });

  it("reads the trend from the two halves of the period", () => {
    const base = { quiet: false, createdAt: new Date("2024-01-01"), period: PERIOD, orders: 5 };
    expect(tradeTrend({ ...base, buckets: [1, 1, 3, 3] })).toBe("growing");
    expect(tradeTrend({ ...base, buckets: [3, 3, 1, 1] })).toBe("slowing");
    expect(tradeTrend({ ...base, buckets: [2, 2, 2, 2] })).toBe("steady");
    expect(tradeTrend({ ...base, buckets: [0, 0, 2, 2] })).toBe("growing");
    expect(tradeTrend({ ...base, buckets: [0, 0, 0, 0], orders: 0 })).toBe("none");
    expect(tradeTrend({ ...base, buckets: [3, 3, 1, 1], quiet: true })).toBe("quiet");
    expect(tradeTrend({ ...base, buckets: [3, 3, 1, 1], createdAt: new Date("2026-09-01") })).toBe("new");
  });

  it("builds a row per firm from its orders and history", () => {
    const firm = { id: 3, name: "Firm C", createdAt: new Date("2022-01-01"), isActive: true, phone: "01234 567890" };
    const placed = days("2026-08-01", "2026-08-10", "2026-08-19");
    const orders = placed.map((at) => order({ tradeFirmId: 3, placedAt: at, paidAt: at, totalPence: 4_000 }));
    const history: HistoryOrder[] = orders.map((row) => ({
      id: row.id,
      placedAt: row.placedAt,
      customer: "director@firm.example",
      tradeFirmId: 3,
    }));
    const [row] = tradeAccountRows({ firms: [firm], orders, refunds: [], history, period: PERIOD, now: NOW });
    expect(row.takingsPence).toBe(12_000);
    expect(row.orders).toBe(3);
    expect(row.usualGapDays).toBe(9);
    expect(row.daysSinceLast).toBe(56);
    expect(row.trend).toBe("quiet");
    expect(row.takingsBeforePence).toBe(12_000);
    expect(row.buckets.reduce((sum, value) => sum + value, 0)).toBe(12_000);
  });

  it("sorts by takings, last order or name", () => {
    const row = (name: string, takingsPence: number, last: string | null) =>
      ({
        firm: { id: 1, name, createdAt: NOW, isActive: true, phone: null },
        takingsPence,
        orders: 1,
        lastOrderAt: last ? new Date(last) : null,
      }) as Parameters<typeof sortTradeRows>[0][number];
    const rows = [row("B", 100, "2026-10-01"), row("A", 300, null), row("C", 200, "2026-10-10")];
    expect(sortTradeRows(rows, "takings").map((r) => r.firm.name)).toEqual(["A", "C", "B"]);
    expect(sortTradeRows(rows, "last-order").map((r) => r.firm.name)).toEqual(["C", "B", "A"]);
    expect(sortTradeRows(rows, "name").map((r) => r.firm.name)).toEqual(["A", "B", "C"]);
    expect(parseTradeSort("name")).toBe("name");
    expect(parseTradeSort("x")).toBe("takings");
  });

  it("says when a firm last ordered", () => {
    const at = new Date("2026-08-24T10:00:00Z");
    expect(lastOrderText(0, at)).toBe("Today");
    expect(lastOrderText(1, at)).toBe("Yesterday");
    expect(lastOrderText(6, at)).toBe("6 days ago");
    expect(lastOrderText(51, at)).toBe("24 Aug");
    expect(lastOrderText(null, null)).toBe("Never");
  });
});

describe("production & timings", () => {
  it("reads the opening hours", () => {
    expect(parseWorkingHours("Mon–Fri 9am–6pm")).toEqual(HOURS);
    expect(parseWorkingHours("Mon-Fri 8:30am - 5pm")).toEqual({ start: 510, end: 1020 });
    expect(parseWorkingHours("by appointment")).toEqual(HOURS);
  });

  it("counts only opening hours on weekdays", () => {
    // Wednesday 10:00 → 12:30 London.
    expect(workingMinutes(new Date("2026-10-14T09:00:00Z"), new Date("2026-10-14T11:30:00Z"), HOURS)).toBe(150);
    // Friday 17:00 → Monday 10:00: an hour on Friday, an hour on Monday.
    expect(workingMinutes(new Date("2026-10-09T16:00:00Z"), new Date("2026-10-12T09:00:00Z"), HOURS)).toBe(120);
    // Evening to the next morning before opening: none.
    expect(workingMinutes(new Date("2026-10-13T19:00:00Z"), new Date("2026-10-14T07:30:00Z"), HOURS)).toBe(0);
    // Across the clocks going back (25 Oct): Friday 17:00 BST → Monday 10:00 GMT.
    expect(workingMinutes(new Date("2026-10-23T16:00:00Z"), new Date("2026-10-26T10:00:00Z"), HOURS)).toBe(120);
    expect(workingMinutes(new Date("2026-10-14T11:00:00Z"), new Date("2026-10-14T10:00:00Z"), HOURS)).toBe(0);
  });

  it("takes the median of each step over the orders that reached it", () => {
    const at = (time: string) => new Date(`2026-10-07T${time}:00Z`);
    const orders = [
      order({ placedAt: at("08:00"), pressAt: at("09:00"), sentAt: at("13:00") }),
      order({ placedAt: at("08:00"), pressAt: at("11:00"), sentAt: null }),
    ];
    const stages = stageTimes(orders, PERIOD, HOURS);
    expect(stages[0]).toMatchObject({ minutes: 120, orders: 2 });
    expect(stages[1]).toMatchObject({ minutes: 240, orders: 1 });
    expect(stages[2]).toMatchObject({ minutes: null, orders: 0 });
    expect(orderToDispatch(orders, PERIOD, HOURS)).toMatchObject({ minutes: 300, orders: 1 });
  });

  it("reads the shop's clock", () => {
    expect(shopClock(new Date("2026-10-14T08:30:00Z"))).toEqual({ weekday: 2, minutes: 570 });
    expect(shopClock(new Date("2026-12-14T08:30:00Z"))).toEqual({ weekday: 0, minutes: 510 });
  });

  it("counts orders placed after the cut-off or at the weekend", () => {
    const orders = [
      order({ placedAt: new Date("2026-10-07T08:30:00Z") }), // Wed 9:30
      order({ placedAt: new Date("2026-10-07T09:30:00Z") }), // Wed 10:30
      order({ placedAt: new Date("2026-10-10T07:00:00Z") }), // Sat 8:00
    ];
    expect(afterCutoff(orders, PERIOD, "10am")).toEqual({ count: 2, total: 3 });
  });

  it("maps orders onto weekday and hour", () => {
    const grid = orderHeatmap(
      [order({ placedAt: new Date("2026-10-12T19:15:00Z") }), order({ placedAt: new Date("2026-10-12T19:45:00Z") })],
      PERIOD,
    );
    expect(grid[0][20]).toBe(2);
    expect(grid.flat().reduce((sum, value) => sum + value, 0)).toBe(2);
    expect(heatLevel(0, 10)).toBe(0);
    expect(heatLevel(1, 10)).toBe(1);
    expect(heatLevel(10, 10)).toBe(4);
    expect(hourText(0)).toBe("12am");
    expect(hourText(11)).toBe("11am");
    expect(hourText(12)).toBe("12pm");
    expect(hourText(21)).toBe("9pm");
  });
});

describe("products & customers", () => {
  it("summarises booklets: copies, pages and what came with them", () => {
    const stats = bookletStats(
      [
        order({ lines: [line({ copies: 50 }), line({ productSlug: "bookmark", copies: 100 })] }),
        order({ lines: [line({ copies: 25, pagesLabel: "4 pages", pageCount: 4 })] }),
        order({ lines: [line({ copies: 100, pagesLabel: "12 pages", pageCount: 12 })] }),
        order({ lines: [line({ productSlug: "memorial-card" })] }),
      ],
      PERIOD,
      PRODUCTS,
    );
    expect(stats.lines).toBe(3);
    expect(stats.medianCopies).toBe(50);
    expect(stats.averageCopies).toBe(58);
    expect(stats.copies).toEqual([
      { copies: 25, count: 1 },
      { copies: 50, count: 1 },
      { copies: 100, count: 1 },
    ]);
    expect(stats.pages.map((row) => row.key)).toEqual(["4 pages", "8 pages", "12 pages"]);
    expect(stats.orders).toBe(3);
    expect(stats.withMore).toBe(1);
    expect(stats.addOns).toEqual([{ key: "bookmark", count: 1, share: 33 }]);
  });

  it("follows first orders in the period to the family's next one", () => {
    const first = order({ customer: "a@example.com", placedAt: new Date("2026-09-01T10:00:00Z") });
    const again = order({
      customer: "a@example.com",
      placedAt: new Date("2026-09-02T10:00:00Z"),
      lines: [line({ designId: "design-1" }), line({ productSlug: "memorial-card", designId: "design-2" })],
    });
    const once = order({ customer: "b@example.com", placedAt: new Date("2026-09-05T10:00:00Z") });
    // A returning family whose first order was before the period isn't followed.
    const old = order({ customer: "c@example.com", placedAt: new Date("2026-09-10T10:00:00Z") });
    const orders = [first, again, once, old];
    const history: HistoryOrder[] = [
      ...orders,
      { id: "older", placedAt: new Date("2026-03-01T10:00:00Z"), customer: "c@example.com", tradeFirmId: null },
    ].map(({ id, placedAt, customer, tradeFirmId }) => ({ id, placedAt, customer, tradeFirmId }));

    const stats = repeatStats(orders, history, PERIOD);
    expect(stats.firstTimers).toBe(2);
    expect(stats.repeaters).toBe(1);
    expect(stats.next).toEqual([
      { key: "memorial-card", families: 1, share: 50, medianDays: 1 },
      { key: SAME_DESIGN, families: 1, share: 50, medianDays: 1 },
    ]);
  });

  it("doesn't count a second order after the window as ordering again", () => {
    const first = order({ customer: "a@example.com", placedAt: new Date("2026-08-01T10:00:00Z") });
    const late = order({ customer: "a@example.com", placedAt: new Date("2026-10-10T10:00:00Z") });
    const history = [first, late].map(({ id, placedAt, customer, tradeFirmId }) => ({
      id,
      placedAt,
      customer,
      tradeFirmId,
    }));
    expect(repeatStats([first, late], history, PERIOD)).toMatchObject({ firstTimers: 1, repeaters: 0 });
  });

  it("counts the warnings accepted on uploaded PDFs", () => {
    const pdf = (warnings: AnalyticsLine["uploadWarnings"]) =>
      line({ source: "pdf", templateSlug: null, designId: null, uploadWarnings: warnings });
    const result = uploadWarnings(
      [
        order({ lines: [pdf(["photos", "bleed"])] }),
        order({ lines: [pdf(["photos"])] }),
        order({ lines: [pdf([])] }),
        order({ lines: [pdf([]), line()] }),
      ],
      PERIOD,
    );
    expect(result).toEqual({
      uploads: 4,
      clean: 2,
      rows: [
        { key: "photos", count: 2, share: 50 },
        { key: "bleed", count: 1, share: 25 },
      ],
    });
  });
});

describe("for the pages", () => {
  it("rounds a chart's scale up to a tidy number", () => {
    expect(niceCeiling(0)).toBe(1);
    expect(niceCeiling(1_830)).toBe(2_000);
    expect(niceCeiling(2_000)).toBe(2_000);
    expect(niceCeiling(2_100)).toBe(5_000);
    expect(niceCeiling(7)).toBe(10);
  });

  it("counts cancelled orders, refunded or not", () => {
    expect(
      cancelledCount([order({ status: "cancelled" }), order({ status: "refunded" }), order()], PERIOD),
    ).toBe(2);
  });

  it("finds the step most people stop at", () => {
    const steps = funnelSteps([
      { label: "Started", count: 200 },
      { label: "In a basket", count: 50 },
      { label: "Ordered", count: 40 },
    ]);
    expect(biggestDrop(steps)).toEqual({ from: "Started", to: "In a basket" });
    expect(biggestDrop(funnelSteps([{ label: "Started", count: 0 }, { label: "Ordered", count: 0 }]))).toBeNull();
  });
});
