import { describe, expect, it } from "vitest";
import {
  CONTACT_TOPICS,
  contactEmail,
  contactTopics,
  formatServiceDate,
  validateContactMessage,
} from "@/lib/contact";

const topics = new Map([
  ["order-of-service", "Order of Service Booklets"],
  ["something-else", "Something else"],
]);

const valid = {
  name: "  Jean Okafor ",
  email: "jean@example.com",
  phone: "",
  topic: "order-of-service",
  serviceDate: "2026-10-09",
  message: "Can you deliver by Thursday?",
};

describe("validateContactMessage", () => {
  it("accepts a complete message, trimmed, with the topic resolved to its label", () => {
    const result = validateContactMessage(valid, topics);
    expect(result).toEqual({
      ok: true,
      message: {
        name: "Jean Okafor",
        email: "jean@example.com",
        phone: null,
        topic: "Order of Service Booklets",
        serviceDate: "2026-10-09",
        message: "Can you deliver by Thursday?",
      },
    });
  });

  it("treats phone and the service date as optional", () => {
    const result = validateContactMessage({ ...valid, serviceDate: "" }, topics);
    expect(result.ok && result.message.serviceDate).toBeNull();
  });

  it("reports every missing required field at once", () => {
    const result = validateContactMessage({}, topics);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(["email", "message", "name", "topic"]);
  });

  it("rejects a malformed email, an unknown topic and an impossible date", () => {
    const result = validateContactMessage(
      { ...valid, email: "jean@", topic: "free-money", serviceDate: "2026-02-31" },
      topics,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(["email", "serviceDate", "topic"]);
  });

  it("rejects an address that would become a reply-to list", () => {
    for (const email of ["jean@example.com,x@evil.test", "jean@example.com; x", "Jean <jean@example.com>"]) {
      const result = validateContactMessage({ ...valid, email }, topics);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(Object.keys(result.errors)).toEqual(["email"]);
    }
  });

  it("rejects non-string and oversized input rather than passing it on", () => {
    const result = validateContactMessage(
      { ...valid, name: 42, message: "a".repeat(5001) },
      topics,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(["message", "name"]);
  });
});

describe("contactEmail", () => {
  const message = {
    name: "Jean <b>Okafor</b>",
    email: "jean@example.com",
    phone: null,
    topic: "Order of Service Booklets",
    serviceDate: "2026-10-09",
    message: "Line one\n<script>alert(1)</script>",
  };

  it("escapes everything the customer typed in the HTML body", () => {
    const { html } = contactEmail(message);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>Okafor</b>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("keeps the subject on one line", () => {
    const { subject } = contactEmail({ ...message, name: "Jean\r\nBcc: someone@example.com" });
    expect(subject).not.toMatch(/[\r\n]/);
  });

  it("spells the service date out, and says when there isn't one", () => {
    // The comma after the weekday depends on the runtime's ICU version.
    expect(contactEmail(message).text).toMatch(/Date of the service: Friday,? 9 October 2026/);
    expect(contactEmail({ ...message, serviceDate: null }).text).toContain(
      "Date of the service: Not given",
    );
  });
});

describe("formatServiceDate", () => {
  it("formats in UTC so the day never shifts with the server's timezone", () => {
    expect(formatServiceDate("2026-01-01")).toMatch(/^Thursday,? 1 January 2026$/);
  });
});

describe("contactTopics", () => {
  it("lists the products first, then the fixed topics", () => {
    const topics = contactTopics([{ id: "bookmarks", label: "Bookmarks" }]);
    expect(topics.map((topic) => topic.id)).toEqual([
      "bookmarks",
      ...CONTACT_TOPICS.map((topic) => topic.id),
    ]);
  });

  it("never lets a product shadow a fixed topic", () => {
    const topics = contactTopics([{ id: "upload", label: "Upload Cards" }]);
    expect(topics.filter((topic) => topic.id === "upload")).toEqual([
      { id: "upload", label: "Uploading my own design" },
    ]);
  });
});
