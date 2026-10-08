import { describe, expect, it } from "vitest";

import {
  orderCancelledEmail,
  orderCancelledNotificationEmail,
  orderConfirmationEmail,
  orderNotificationEmail,
  reviewRequestEmail,
  adminInviteEmail,
  adminSignInEmail,
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
  serviceDate: null,
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

  it("names the funeral date when one was given, and only then", () => {
    expect(email.html).not.toContain(">Funeral<");
    const dated = orderConfirmationEmail({ ...summary, serviceDate: "2026-10-16" }, "https://example.com/orders/abc");
    expect(dated.html).toContain(">Funeral<");
    expect(dated.html).toMatch(/Friday,? 16 October 2026/);
    expect(dated.text).toMatch(/Funeral: Friday,? 16 October 2026/);
  });

  it("leads the inbox preview with the order, not the logo's alt text", () => {
    expect(email.html).toMatch(/<div style="display:none[^"]*">We've received your order TFS-2026-004210/);
  });

  it("sends a reply to the shop's inbox, since it invites one", () => {
    expect(email.text).toContain("reply to this email");
    expect(email.replyTo).toBe("info@thefuneralstationery.co.uk");
  });

  it("gives a plain-text reader the same next steps as the html", () => {
    expect(email.html).toContain("What happens next");
    expect(email.text).toContain("What happens next:");
    expect(email.text).toMatch(/Call us on [^\n]+ as soon as you can/);
  });
});

describe("orderNotificationEmail", () => {
  it("names the funeral date in the plain text too, since it decides how urgent the order is", () => {
    const dated = orderNotificationEmail({ ...summary, serviceDate: "2026-10-16" }, "https://example.com/admin/orders/abc");
    expect(dated.text).toMatch(/Funeral: Friday,? 16 October 2026/);
  });

  it("sends a reply to the customer", () => {
    expect(orderNotificationEmail(summary, "https://example.com/admin/orders/abc").replyTo).toBe("jane@example.com");
  });

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

  it("says what has been refunded already", () => {
    const part = orderCancelledNotificationEmail(summary, "https://example.com/admin/orders/abc", 2000);
    expect(part.subject).toContain("refund £79.99?");
    expect(part.text).toContain("£20.00 of it has been refunded");
    expect(part.text).not.toContain("Nothing has been refunded");

    const full = orderCancelledNotificationEmail(summary, "https://example.com/admin/orders/abc", 9999);
    expect(full.subject).toContain("already refunded");
    expect(full.text).toContain("refunded in full (£99.99)");
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

describe("adminSignInEmail", () => {
  it("carries the link, escaped in the html", () => {
    const url = "https://tfs.example/admin/verify?token=a%2Bb&x=1";
    const { subject, text, html } = adminSignInEmail(url);
    expect(subject).toMatch(/admin sign-in link/i);
    expect(text).toContain(url);
    expect(html).toContain('href="https://tfs.example/admin/verify?token=a%2Bb&amp;x=1"');
  });

  it("is laid out in tables with a copyable fallback link", () => {
    const url = "https://tfs.example/admin/verify?token=abc";
    const { html } = adminSignInEmail(url);
    expect(html).toContain('role="presentation"');
    expect(html).toContain(">Sign in to admin</a>");
    expect(html.split(`href="${url}"`)).toHaveLength(3);
    expect(html).toContain("expires in 15 minutes");
  });
});

describe("branded emails", () => {
  const emails = {
    orderConfirmation: orderConfirmationEmail(summary, "https://example.com/orders/abc"),
    orderNotification: orderNotificationEmail(summary, "https://example.com/admin/orders/abc"),
    orderCancelled: orderCancelledEmail(summary, "https://example.com/orders/abc"),
    orderCancelledNotification: orderCancelledNotificationEmail(summary, "https://example.com/admin/orders/abc"),
    signIn: signInEmail("https://tfs.example/api/auth/verify?token=abc"),
    adminSignIn: adminSignInEmail("https://tfs.example/admin/verify?token=abc"),
    adminInvite: adminInviteEmail({ signInPageUrl: "https://tfs.example/admin/login", invitedBy: "a@example.com" }),
  };

  it.each(Object.entries(emails))("%s carries the logo it shows, inline", (_, { html, attachments }) => {
    const cids = [...html.matchAll(/src="cid:([^"]+)"/g)].map((m) => m[1]);
    expect(cids).toHaveLength(1);
    const logo = attachments?.find((a) => a.contentId === cids[0]);
    expect(logo?.contentType).toBe("image/png");
    // A real PNG, base64: the signature 89 50 4E 47.
    expect(Buffer.from(logo!.content, "base64").subarray(0, 4).toString("hex")).toBe("89504e47");
    expect(html).toContain('alt="The Funeral Stationery"');
  });
});

describe("adminInviteEmail", () => {
  it("names who granted access and links to the sign-in page, not a sign-in link", () => {
    const { text, html } = adminInviteEmail({
      signInPageUrl: "https://tfs.example/admin/login?email=jo%40example.com",
      invitedBy: "<owner>@example.com",
    });
    expect(text).toContain("<owner>@example.com has given this email address access");
    expect(html).toContain("&lt;owner&gt;@example.com");
    expect(html).toContain('href="https://tfs.example/admin/login?email=jo%40example.com"');
    expect(text).not.toContain("/admin/verify");
  });
});

describe("reviewRequestEmail", () => {
  const email = reviewRequestEmail({
    contactName: "Jane <Doe>",
    reviewUrl: "https://search.google.com/local/writereview?placeid=abc",
    optOutUrl: "https://shop.example/email/unsubscribe?t=tok",
    oneClickUrl: "https://shop.example/api/email/unsubscribe?t=tok",
  });

  it("asks once, gently, and never for a star rating", () => {
    expect(email.subject).toBe("Thank you from The Funeral Stationery");
    expect(email.text).toContain("If you feel comfortable");
    expect(email.text).toContain("no obligation");
    expect(`${email.text}${email.html}`).not.toMatch(/five|5[- ]star/i);
    expect(email.html).toContain("Share your experience on Google");
    expect(email.html).toContain('href="https://search.google.com/local/writereview?placeid=abc"');
  });

  it("escapes the customer's name", () => {
    expect(email.html).toContain("Dear Jane &lt;Doe&gt;,");
    expect(email.html).not.toContain("<Doe>");
  });

  it("carries a way to stop them, in the body and for the mail client's own button", () => {
    expect(email.text).toContain("https://shop.example/email/unsubscribe?t=tok");
    expect(email.html).toContain("Stop emails like this one");
    expect(email.headers).toEqual({
      "List-Unsubscribe": "<https://shop.example/api/email/unsubscribe?t=tok>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it("is a reply to the shop, with the logo attached", () => {
    expect(email.replyTo).toBe("info@thefuneralstationery.co.uk");
    expect(email.attachments).toHaveLength(1);
  });
});
