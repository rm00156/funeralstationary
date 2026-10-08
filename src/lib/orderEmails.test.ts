import { describe, expect, it } from "vitest";

import {
  orderCancelledEmail,
  orderCancelledNotificationEmail,
  orderConfirmationEmail,
  orderNotificationEmail,
  signInEmail,
  type OrderEmailSummary,
} from "@/lib/orderEmails";

const summary: OrderEmailSummary = {
  orderNumber: "TFS-2026-004210",
  contactName: "Jane <Doe>",
  contactEmail: "jane@example.com",
  items: [
    {
      name: "Order of Service — Whispering Petals",
      spec: "50 copies · A5 · Silk",
      copies: 50,
      lineTotalPence: 9000,
      deliveryLabel: "Next day",
      deliveryPence: 999,
    },
  ],
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

  it("says no VAT, rather than VAT of £0.00, for a zero-rated order", () => {
    const zero = orderConfirmationEmail({ ...summary, vatPence: 0 }, "https://example.com/orders/abc");
    expect(zero.text).toContain("Total: £99.99 (no VAT)");
    expect(zero.html).toContain("no VAT");
    expect(zero.html).not.toContain("£0.00");
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
    expect(email.text).toContain("Delivery: Next day (£9.99)");
  });
});

describe("orderCancelledEmail", () => {
  const email = orderCancelledEmail(summary, "https://example.com/orders/abc");

  it("says it won't be printed, links the order, and doesn't claim a refund was made", () => {
    expect(email.subject).toContain("TFS-2026-004210");
    expect(email.subject).toContain("cancelled");
    expect(email.text).toContain("will not be printed");
    expect(email.text).toContain("https://example.com/orders/abc");
    expect(email.text).not.toMatch(/has been refunded|we have refunded/i);
  });

  it("escapes HTML in customer-supplied text", () => {
    expect(email.html).toContain("Jane &lt;Doe&gt;");
    expect(email.html).not.toContain("<Doe>");
  });
});

describe("orderCancelledNotificationEmail", () => {
  it("tells the shop what was paid and that the refund is still to do", () => {
    const email = orderCancelledNotificationEmail(summary, "https://example.com/admin/orders/abc");
    expect(email.subject).toContain("TFS-2026-004210");
    expect(email.text).toContain("£99.99");
    expect(email.text).toContain("Nothing has been refunded");
    expect(email.text).toContain("https://example.com/admin/orders/abc");
  });
});

describe("signInEmail", () => {
  it("carries the link, escaped in the html, and says nothing about the account", () => {
    const url = "https://tfs.example/api/auth/verify?token=a%2Bb&x=1";
    const { subject, text, html } = signInEmail(url);
    expect(subject).toContain("sign-in link");
    expect(text).toContain(url);
    expect(html).toContain('href="https://tfs.example/api/auth/verify?token=a%2Bb&amp;x=1"');
    expect(text).not.toMatch(/no account|not found|unknown/i);
  });
});
