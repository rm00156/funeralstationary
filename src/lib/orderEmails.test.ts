import { describe, expect, it } from "vitest";

import {
  orderConfirmationEmail,
  orderNotificationEmail,
  type OrderEmailSummary,
} from "@/lib/orderEmails";

const summary: OrderEmailSummary = {
  orderNumber: "TFS-2026-004210",
  contactName: "Jane <Doe>",
  contactEmail: "jane@example.com",
  items: [
    { name: "Order of Service — Whispering Petals", spec: "50 copies · A5 · Silk", copies: 50, lineTotalPence: 9000 },
  ],
  deliveryLabel: "Next day",
  deliveryPence: 999,
  subtotalPence: 9000,
  vatPence: 1667,
  totalPence: 9999,
  addressLines: ["1 High Street", "Leeds", "LS1 1AA"],
};

describe("orderConfirmationEmail", () => {
  const email = orderConfirmationEmail(summary, "https://example.com/orders/abc");

  it("carries the order number, total and link in every part", () => {
    expect(email.subject).toContain("TFS-2026-004210");
    expect(email.text).toContain("£99.99");
    expect(email.text).toContain("includes VAT of £16.67");
    expect(email.text).toContain("https://example.com/orders/abc");
    expect(email.html).toContain("£99.99");
  });

  it("escapes HTML in customer-supplied text", () => {
    expect(email.html).toContain("Jane &lt;Doe&gt;");
    expect(email.html).not.toContain("<Doe>");
  });
});

describe("orderNotificationEmail", () => {
  it("leads with who ordered and how much", () => {
    const email = orderNotificationEmail(summary, "https://example.com/admin/orders/abc");
    expect(email.subject).toBe("New order TFS-2026-004210 — £99.99");
    expect(email.text).toContain("jane@example.com");
    expect(email.text).toContain("Next day");
  });
});
