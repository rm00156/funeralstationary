import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { BOOKLET_FORMAT } from "@/lib/designEditor";
import type { OrderDetail, OrderDetailItem } from "@/lib/orders.server";
import { canTransition, computeOrderTotals, type OrderStatus } from "@/lib/orders";
import { VAT_TREATMENT_RATE, type VatTreatment } from "@/lib/vat";
import {
  buildThintentOrderPayload,
  pressFileSignature,
  pressFileUrl,
  verifyPressFileSignature,
  buildThintentRefundPayload,
  canSendToThintent,
  forwardStatusPath,
  parseThintentJobEvent,
  thintentStatusMoves,
  thintentTargetStatus,
  verifyThintentSignature,
} from "@/lib/thintent";

const quote = {
  quantity: { id: "50", label: "50 copies", multiplier: 1, value: 50 },
  pages: { id: "8", label: "8 page", pages: 8, baseRatePence: 120 },
  paper: { id: "silk", label: "Silk", multiplier: 1 },
  delivery: { id: "standard", label: "Standard delivery", pricePence: 499, note: "" },
  unitPricePence: 120,
  printCostPence: 6000,
  totalPence: 6499,
};

function item(overrides: Partial<OrderDetailItem> = {}): OrderDetailItem {
  return {
    id: "item-1",
    designId: "design-1",
    designName: "Mum's booklet",
    productId: "order-of-service",
    format: BOOKLET_FORMAT,
    artworkTrim: BOOKLET_FORMAT.trim,
    templateId: "classic",
    artwork: null,
    serviceDate: null,
    pageCount: 8,
    quote,
    quantityCopies: 50,
    unitPricePence: 120,
    lineTotalPence: 6000,
    delivery: { optionId: "standard", label: "Standard delivery", pricePence: 499 },
    vatTreatment: null,
    proofs: [],
    ...overrides,
  };
}

function order(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    id: "order-1",
    orderNumber: "TFS-2026-123456",
    status: "awaiting_print",
    placedAt: new Date("2026-10-06T10:00:00Z"),
    paidAt: new Date("2026-10-06T10:01:00Z"),
    createdAt: new Date("2026-10-06T09:00:00Z"),
    contact: { name: "Jo Bloggs", email: "jo@example.com", phone: null },
    address: { line1: "1 High St", line2: null, city: "Leeds", postcode: "LS1 1AA", country: "GB" },
    totals: { subtotalPence: 6000, deliveryPence: 499, vatPence: 1083, vatRate: 0.2, totalPence: 6499 },
    items: [item()],
    events: [],
    stripe: { checkoutSessionId: "cs_1", paymentIntentId: "pi_1" },
    thintent: null,
    tracking: { courier: null, ref: null },
    refunds: [],
    ...overrides,
  };
}

const options = {
  siteOrigin: "https://shop.example",
  productLabels: new Map([["order-of-service", "Order of Service booklet"]]),
  test: false,
  pressKey: "press-key",
  feePence: 118,
};

describe("buildThintentOrderPayload", () => {
  it("describes the paid order, with money that adds up the way Thintent checks it", () => {
    const payload = buildThintentOrderPayload(order(), options);
    expect(payload.externalRef).toBe("TFS-2026-123456");
    expect(payload.customer).toEqual({ name: "Jo Bloggs", email: "jo@example.com", phone: null });
    expect(payload.payment).toEqual({
      amountPence: 6499,
      reference: "pi_1",
      paidAt: "2026-10-06T10:01:00.000Z",
      feePence: 118,
    });
    const lineSum = payload.lines.reduce((sum, line) => sum + line.lineTotalPence, 0);
    expect(lineSum).toBe(payload.totals.subtotalPence);
    expect(payload.delivery?.pricePence).toBe(payload.totals.deliveryPence);
    expect(payload.totals.subtotalPence + payload.totals.deliveryPence).toBe(payload.totals.totalPence);
    expect(payload.payment.amountPence).toBe(payload.totals.totalPence);
  });

  it("passes an unknown Stripe fee on as null", () => {
    expect(buildThintentOrderPayload(order(), { ...options, feePence: null }).payment.feePence).toBeNull();
  });

  it("names each line's product by the options that change what a copy costs, not the copies", () => {
    const [line] = buildThintentOrderPayload(order(), options).lines;
    expect(line.product).toEqual({
      code: "order-of-service/8/silk",
      name: "Order of Service booklet · A5 · 8 page · Silk",
    });
    const more = buildThintentOrderPayload(
      order({ items: [item({ quote: { ...quote, quantity: { ...quote.quantity, id: "100", value: 100 } } })] }),
      options,
    );
    expect(more.lines[0].product?.code).toBe("order-of-service/8/silk");
    const gloss = buildThintentOrderPayload(
      order({ items: [item({ quote: { ...quote, paper: { ...quote.paper, id: "gloss", label: "Gloss" } } })] }),
      options,
    );
    expect(gloss.lines[0].product?.code).toBe("order-of-service/8/gloss");
  });

  it("leaves the product off a delivery charge sent as a line", () => {
    const payload = buildThintentOrderPayload(taxedOrder([["standard", 6000, 499], ["zero", 3000, 299]]), options);
    const deliveryLines = payload.lines.filter((line) => line.externalRef.startsWith("delivery-"));
    expect(deliveryLines.length).toBeGreaterThan(0);
    expect(deliveryLines.every((line) => line.product === null)).toBe(true);
  });

  it("sends an order paid before VAT treatments as it always did — no treatments, one delivery charge", () => {
    const payload = buildThintentOrderPayload(order(), options);
    expect(payload.lines.map((line) => line.vatTreatment)).toEqual([null]);
    expect(payload.delivery).toMatchObject({ pricePence: 499, vatTreatment: null });
  });

  /** An order of lines at the given treatments, its totals from the real computeOrderTotals. */
  function taxedOrder(lines: [VatTreatment, number, number, string?][], address = order().address): OrderDetail {
    const items = lines.map(([vatTreatment, print, deliveryPence, label = "Standard delivery"], i) =>
      item({
        id: `item-${i}`,
        vatTreatment,
        lineTotalPence: print,
        delivery: { optionId: label, label, pricePence: deliveryPence },
      }),
    );
    const totals = computeOrderTotals(
      lines.map(([vatTreatment, printPence, deliveryPence]) => ({ printPence, deliveryPence, vatTreatment })),
    );
    return order({ items, totals, address });
  }

  /** Thintent's own check (lib/order-import.ts): VAT per component, a penny either way per VAT-charging one. */
  function thintentAcceptsVat(payload: ReturnType<typeof buildThintentOrderPayload>) {
    const components: [number, VatTreatment][] = payload.lines.map((line) => [line.lineTotalPence, line.vatTreatment!]);
    if (payload.totals.deliveryPence > 0) components.push([payload.totals.deliveryPence, payload.delivery!.vatTreatment!]);
    const charged = components.filter(([, t]) => VAT_TREATMENT_RATE[t] > 0);
    const expected = charged.reduce((sum, [gross, t]) => sum + gross - Math.round(gross / (1 + VAT_TREATMENT_RATE[t])), 0);
    return Math.abs(expected - payload.totals.vatPence) <= charged.length;
  }

  function addsUp(payload: ReturnType<typeof buildThintentOrderPayload>) {
    const lineSum = payload.lines.reduce((sum, line) => sum + line.lineTotalPence, 0);
    return (
      lineSum === payload.totals.subtotalPence &&
      (payload.delivery?.pricePence ?? 0) === payload.totals.deliveryPence &&
      payload.totals.subtotalPence + payload.totals.deliveryPence === payload.totals.totalPence &&
      payload.payment.amountPence === payload.totals.totalPence
    );
  }

  it("sends each line's VAT treatment, and the delivery's when every charge shares one", () => {
    const payload = buildThintentOrderPayload(taxedOrder([["zero", 6000, 499], ["zero", 3000, 0]]), options);
    expect(payload.lines.map((line) => line.vatTreatment)).toEqual(["zero", "zero"]);
    expect(payload.delivery).toMatchObject({ pricePence: 499, vatTreatment: "zero" });
    expect(payload.totals.vatPence).toBe(0);
    expect(addsUp(payload)).toBe(true);
    expect(thintentAcceptsVat(payload)).toBe(true);
  });

  it("keeps the biggest delivery group as the delivery and sends the rest as lines at their own treatment", () => {
    const payload = buildThintentOrderPayload(
      taxedOrder([
        ["zero", 6000, 499, "Standard delivery"],
        ["standard", 3000, 999, "Next day"],
        ["standard", 2000, 999, "Next day"],
      ]),
      options,
    );
    expect(payload.delivery).toMatchObject({ pricePence: 1998, vatTreatment: "standard", label: "Next day" });
    expect(payload.lines.at(-1)).toMatchObject({
      externalRef: "delivery-zero",
      title: "Delivery — Standard delivery (zero-rated items)",
      quantity: 1,
      lineTotalPence: 499,
      vatTreatment: "zero",
    });
    expect(payload.totals).toMatchObject({ subtotalPence: 11_499, deliveryPence: 1998, totalPence: 13_497 });
    expect(addsUp(payload)).toBe(true);
    expect(thintentAcceptsVat(payload)).toBe(true);
  });

  it("names the delivery after what it charges for and the free options, not the charges moved to lines", () => {
    const payload = buildThintentOrderPayload(
      taxedOrder([
        ["zero", 6000, 999, "Next day"],
        ["standard", 3000, 399, "Standard"],
        ["standard", 2000, 0, "Collect in person"],
      ]),
      options,
    );
    expect(payload.delivery).toMatchObject({ pricePence: 999, label: "Next day + Collect in person" });
  });

  it("sends every delivery charge as a line when there's no address to deliver to", () => {
    const payload = buildThintentOrderPayload(
      taxedOrder([["standard", 6000, 499]], { line1: null, line2: null, city: null, postcode: null, country: "GB" }),
      options,
    );
    expect(payload.delivery).toBeNull();
    expect(payload.totals.deliveryPence).toBe(0);
    expect(payload.lines.at(-1)).toMatchObject({ lineTotalPence: 499, vatTreatment: "standard" });
    expect(addsUp(payload)).toBe(true);
  });

  it("always reports VAT Thintent accepts, across mixed baskets", () => {
    let seed = 11;
    const next = (max: number) => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed % max;
    };
    const treatments: VatTreatment[] = ["standard", "reduced", "zero", "exempt"];
    for (let run = 0; run < 300; run++) {
      const lines = Array.from(
        { length: 1 + next(5) },
        (): [VatTreatment, number, number, string] => [
          treatments[next(4)],
          next(30_000),
          [0, 299, 499, 999][next(4)],
          ["Standard delivery", "Next day"][next(2)],
        ],
      );
      const payload = buildThintentOrderPayload(taxedOrder(lines), options);
      expect(addsUp(payload), JSON.stringify(lines)).toBe(true);
      expect(thintentAcceptsVat(payload), JSON.stringify(lines)).toBe(true);
    }
  });

  it("titles and specs an editor design, linking its print PDF rather than the proof images", () => {
    const proofs = [
      { id: "p2", version: 2, pdfUrl: null, createdAt: new Date(), pages: [{ pageIndex: 0, imageUrl: "https://cdn/p2-1.jpg" }] },
      { id: "p1", version: 1, pdfUrl: "https://cdn/v1.pdf", createdAt: new Date(), pages: [] },
    ];
    const [line] = buildThintentOrderPayload(order({ items: [item({ proofs })] }), options).lines;
    expect(line.title).toBe("Order of Service booklet — Mum's booklet");
    expect(line.spec).toContainEqual({ label: "Spec", value: "A5 · 8 page · Silk" });
    expect(line.files).toEqual([
      { label: "Print PDF", url: pressFileUrl("https://shop.example", "order-1", item().id, "press-key") },
    ]);
  });

  it("links the order page when an editor design has no proof yet", () => {
    const [line] = buildThintentOrderPayload(order({ items: [item({ proofs: [] })] }), options).lines;
    expect(line.files).toEqual([
      { label: "No proof yet — make one on the website's order page", url: "https://shop.example/admin/orders/order-1" },
    ]);
  });

  it("sends an upload's own PDF and the warnings the customer accepted, with the service date as the deadline", () => {
    const artwork = {
      source: "pdf" as const,
      fileName: "mum.pdf",
      url: "https://cdn/uploads/mum.pdf",
      storageKey: "uploads/x/mum.pdf",
      byteSize: 1000,
      canvaUrl: null,
      pageCount: 8,
      trim: BOOKLET_FORMAT.trim,
      checks: [
        { id: "bleed" as const, status: "warn" as const, title: "No bleed", detail: "Edges may show white." },
        { id: "size" as const, status: "pass" as const, title: "Size", detail: "A5." },
      ],
      warningsAcceptedAt: "2026-10-06T09:59:00Z",
      confirmedAt: "2026-10-06T09:59:30Z",
    };
    const [line] = buildThintentOrderPayload(
      order({ items: [item({ artwork, designId: null, designName: "Order of Service booklet — mum.pdf", serviceDate: "2026-10-13" })] }),
      options,
    ).lines;
    expect(line.title).toBe("Order of Service booklet — mum.pdf");
    expect(line.files).toEqual([{ label: "Customer's PDF — mum.pdf", url: "https://cdn/uploads/mum.pdf" }]);
    expect(line.notes).toBe("Customer chose to print it as it is: No bleed. Edges may show white.");
    expect(line.dueDate).toBe("2026-10-13");
    expect(line.spec).toContainEqual({ label: "Service date", value: "2026-10-13" });
    // Costs the same to print as a designed booklet of the same spec.
    expect(line.product?.code).toBe("order-of-service/8/silk");
  });

  it("flags a Canva line as unchecked", () => {
    const artwork = {
      source: "canva" as const,
      fileName: null,
      url: null,
      storageKey: null,
      byteSize: null,
      canvaUrl: "https://www.canva.com/design/abc/view",
      pageCount: null,
      trim: BOOKLET_FORMAT.trim,
      checks: [],
      warningsAcceptedAt: null,
      confirmedAt: "2026-10-06T09:59:30Z",
    };
    const [line] = buildThintentOrderPayload(order({ items: [item({ artwork, designId: null })] }), options).lines;
    expect(line.files).toEqual([{ label: "Canva design (not checked yet)", url: "https://www.canva.com/design/abc/view" }]);
    expect(line.notes).toMatch(/not checked yet/);
  });

  it("sums per-line delivery into one charge, listing each option once", () => {
    const payload = buildThintentOrderPayload(
      order({
        items: [
          item(),
          item({ id: "item-2", delivery: { optionId: "next-day", label: "Next day", pricePence: 999 } }),
          item({ id: "item-3" }),
        ],
        totals: { subtotalPence: 18000, deliveryPence: 1997, vatPence: 3333, vatRate: 0.2, totalPence: 19997 },
      }),
      options,
    );
    expect(payload.delivery?.label).toBe("Standard delivery + Next day");
    expect(payload.delivery?.pricePence).toBe(1997);
  });

  it("trims customer text to Thintent's column limits rather than have the order refused", () => {
    const payload = buildThintentOrderPayload(
      order({ contact: { name: "Jo", email: "jo@example.com", phone: "0".repeat(50) } }),
      options,
    );
    expect(payload.customer.phone).toHaveLength(32);
    expect(payload.customer.phone?.endsWith("…")).toBe(true);
  });

  it("refuses an unpaid order", () => {
    expect(() => buildThintentOrderPayload(order({ paidAt: null }), options)).toThrow(/not been paid/);
  });
});

describe("thintentTargetStatus / forwardStatusPath", () => {
  it("maps job statuses onto this site's, leaving pauses and review alone", () => {
    expect(thintentTargetStatus("pre_press")).toBe("awaiting_print");
    expect(thintentTargetStatus("in_production")).toBe("in_production");
    expect(thintentTargetStatus("ready_for_dispatch")).toBe("in_production");
    expect(thintentTargetStatus("dispatched")).toBe("shipped");
    expect(thintentTargetStatus("completed")).toBe("delivered");
    expect(thintentTargetStatus("cancelled")).toBe("cancelled");
    expect(thintentTargetStatus("paused_for_change")).toBeNull();
    expect(thintentTargetStatus("pending_review")).toBeNull();
  });

  it("walks through the steps a job skipped, each a legal transition", () => {
    const steps = forwardStatusPath("awaiting_print", "shipped");
    expect(steps).toEqual(["in_production", "shipped"]);
    let at: OrderStatus = "awaiting_print";
    for (const step of steps) {
      expect(canTransition(at, step)).toBe(true);
      at = step;
    }
  });

  it("never moves an order backwards or off a cancelled/refunded/draft order", () => {
    expect(forwardStatusPath("shipped", "in_production")).toEqual([]);
    expect(forwardStatusPath("shipped", "shipped")).toEqual([]);
    expect(forwardStatusPath("cancelled", "shipped")).toEqual([]);
    expect(forwardStatusPath("refunded", "delivered")).toEqual([]);
    expect(forwardStatusPath("draft", "in_production")).toEqual([]);
  });
});

describe("thintentStatusMoves", () => {
  it("cancels an order that hasn't shipped", () => {
    expect(thintentStatusMoves("awaiting_print", "cancelled", false)).toEqual(["cancelled"]);
    expect(thintentStatusMoves("in_production", "cancelled", false)).toEqual(["cancelled"]);
  });

  it("can't cancel one that has gone out, a basket, or one already closed", () => {
    expect(thintentStatusMoves("shipped", "cancelled", false)).toEqual([]);
    expect(thintentStatusMoves("delivered", "cancelled", false)).toEqual([]);
    expect(thintentStatusMoves("draft", "cancelled", false)).toEqual([]);
    expect(thintentStatusMoves("cancelled", "cancelled", true)).toEqual([]);
    expect(thintentStatusMoves("refunded", "cancelled", false)).toEqual([]);
  });

  it("reopens an order Thintent cancelled, walking it to where the job is now", () => {
    expect(thintentStatusMoves("cancelled", "pre_press", true)).toEqual(["awaiting_print"]);
    expect(thintentStatusMoves("cancelled", "dispatched", true)).toEqual([
      "awaiting_print",
      "in_production",
      "shipped",
    ]);
  });

  it("leaves a cancel made here, or a refunded order, alone whatever the job does", () => {
    expect(thintentStatusMoves("cancelled", "pre_press", false)).toEqual([]);
    expect(thintentStatusMoves("refunded", "pre_press", true)).toEqual([]);
  });

  it("walks forward otherwise, and ignores a pause", () => {
    expect(thintentStatusMoves("awaiting_print", "dispatched", false)).toEqual(["in_production", "shipped"]);
    expect(thintentStatusMoves("in_production", "paused_for_change", false)).toEqual([]);
  });
});

describe("parseThintentJobEvent", () => {
  it("reads a job.updated body and ignores anything else", () => {
    expect(
      parseThintentJobEvent({
        event: "job.updated",
        externalRef: "TFS-2026-123456",
        jobNumber: 42,
        status: "dispatched",
        courier: "Royal Mail",
        trackingRef: " AB123 ",
      }),
    ).toEqual({ externalRef: "TFS-2026-123456", jobNumber: 42, status: "dispatched", courier: "Royal Mail", trackingRef: "AB123" });
    expect(parseThintentJobEvent({ event: "job.created", externalRef: "x", status: "y" })).toBeNull();
    expect(parseThintentJobEvent({ event: "job.updated", status: "dispatched" })).toBeNull();
    expect(parseThintentJobEvent("nope")).toBeNull();
  });
});

describe("verifyThintentSignature", () => {
  const secret = "whsec_test";
  const body = '{"event":"job.updated"}';
  const now = 1_790_000_000;
  const sign = (t: number, payload = body, key = secret) =>
    `t=${t},v1=${createHmac("sha256", key).update(`${t}.${payload}`).digest("hex")}`;

  it("accepts a fresh, correctly signed body", () => {
    expect(verifyThintentSignature(sign(now), body, secret, now)).toBe(true);
    expect(verifyThintentSignature(sign(now - 299), body, secret, now)).toBe(true);
  });

  it("refuses a tampered body, the wrong secret, a stale timestamp or a malformed header", () => {
    expect(verifyThintentSignature(sign(now), '{"event":"job.updated","x":1}', secret, now)).toBe(false);
    expect(verifyThintentSignature(sign(now, body, "other"), body, secret, now)).toBe(false);
    expect(verifyThintentSignature(sign(now - 301), body, secret, now)).toBe(false);
    expect(verifyThintentSignature("v1=abc", body, secret, now)).toBe(false);
    expect(verifyThintentSignature(null, body, secret, now)).toBe(false);
    expect(verifyThintentSignature(sign(now), body, "", now)).toBe(false);
  });
});

describe("buildThintentRefundPayload", () => {
  const refund = { stripeRefundId: "re_1", amountPence: 2400, status: "succeeded", refundedAt: new Date("2026-10-07T11:30:00Z") };

  it("keys the credit note on the Stripe refund id and sends VAT-inclusive pence", () => {
    expect(buildThintentRefundPayload(refund)).toEqual({
      refundRef: "re_1",
      amountPence: 2400,
      refundedAt: "2026-10-07T11:30:00.000Z",
    });
  });

  it("refuses a refund that hasn't reached the customer", () => {
    expect(() => buildThintentRefundPayload({ ...refund, status: "pending" })).toThrow();
    expect(() => buildThintentRefundPayload({ ...refund, status: "failed" })).toThrow();
  });
});

describe("press file links", () => {
  it("signs the order and line, and checks the signature against both", () => {
    const url = new URL(pressFileUrl("https://shop.example", "order-1", "item-1", "key"));
    expect(url.pathname).toBe("/api/thintent/press/order-1/item-1");
    const sig = url.searchParams.get("sig");
    expect(sig).toBe(pressFileSignature("order-1", "item-1", "key"));
    expect(verifyPressFileSignature("order-1", "item-1", sig, "key")).toBe(true);
    expect(verifyPressFileSignature("order-1", "item-2", sig, "key")).toBe(false);
    expect(verifyPressFileSignature("order-2", "item-1", sig, "key")).toBe(false);
    expect(verifyPressFileSignature("order-1", "item-1", sig, "other-key")).toBe(false);
  });

  it("refuses a missing or malformed signature, or no key", () => {
    const sig = pressFileSignature("order-1", "item-1", "key");
    expect(verifyPressFileSignature("order-1", "item-1", null, "key")).toBe(false);
    expect(verifyPressFileSignature("order-1", "item-1", "abc", "key")).toBe(false);
    expect(verifyPressFileSignature("order-1", "item-1", sig.slice(0, 62) + "zz", "key")).toBe(false);
    expect(verifyPressFileSignature("order-1", "item-1", sig, "")).toBe(false);
  });
});

describe("canSendToThintent", () => {
  it("sends only a paid order still waiting for the press", () => {
    expect(canSendToThintent("awaiting_print")).toBe(true);
    for (const status of ["draft", "in_production", "shipped", "delivered", "cancelled", "refunded"] as OrderStatus[]) {
      expect(canSendToThintent(status)).toBe(false);
    }
  });
});
