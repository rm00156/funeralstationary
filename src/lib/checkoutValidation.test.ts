import { describe, expect, it } from "vitest";

import {
  parseCheckoutDetails,
  parseEmail,
  parseName,
  parseOptionalAddressLine,
  parsePhone,
  parseUkPostcode,
} from "@/lib/checkoutValidation";

describe("parseEmail", () => {
  it("normalises case and whitespace", () => {
    expect(parseEmail("  Jane@Example.COM ")).toBe("jane@example.com");
  });
  it("rejects anything without a mailbox and a dotted domain", () => {
    expect(parseEmail("jane")).toBeNull();
    expect(parseEmail("jane@example")).toBeNull();
    expect(parseEmail("j ane@example.com")).toBeNull();
    expect(parseEmail(42)).toBeNull();
  });
});

describe("parsePhone", () => {
  it("treats absent or blank as null (optional field)", () => {
    expect(parsePhone(undefined)).toBeNull();
    expect(parsePhone("")).toBeNull();
    expect(parsePhone("   ")).toBeNull();
  });
  it("accepts the usual separators and rejects junk", () => {
    expect(parsePhone("+44 (0)7700 900123")).toBe("+44 (0)7700 900123");
    expect(parsePhone("0121 496 0000")).toBe("0121 496 0000");
    expect(parsePhone("call me")).toBeUndefined();
    expect(parsePhone("12345")).toBeUndefined();
    expect(parsePhone(7700900123)).toBeUndefined();
  });
});

describe("parseUkPostcode", () => {
  it("normalises spacing and case", () => {
    expect(parseUkPostcode("sw1a1aa")).toBe("SW1A 1AA");
    expect(parseUkPostcode("  m1  1ae ")).toBe("M1 1AE");
    expect(parseUkPostcode("B33 8TH")).toBe("B33 8TH");
    expect(parseUkPostcode("CR2 6XH")).toBe("CR2 6XH");
    expect(parseUkPostcode("DN55 1PT")).toBe("DN55 1PT");
  });
  it("rejects non-UK shapes", () => {
    expect(parseUkPostcode("90210")).toBeNull();
    expect(parseUkPostcode("SW1A")).toBeNull();
    expect(parseUkPostcode("")).toBeNull();
    expect(parseUkPostcode(null)).toBeNull();
  });
});

describe("parseName / parseOptionalAddressLine", () => {
  it("collapses internal whitespace", () => {
    expect(parseName("  Jane   Doe ")).toBe("Jane Doe");
  });
  it("optional line: blank is null, too long is invalid", () => {
    expect(parseOptionalAddressLine("")).toBeNull();
    expect(parseOptionalAddressLine("Flat 2")).toBe("Flat 2");
    expect(parseOptionalAddressLine("x".repeat(256))).toBeUndefined();
  });
});

describe("parseCheckoutDetails", () => {
  const valid = {
    contactName: "Jane Doe",
    contactEmail: "jane@example.com",
    contactPhone: "",
    addressLine1: "1 High Street",
    addressLine2: "",
    city: "Leeds",
    postcode: "ls1 1aa",
  };

  it("returns the normalised details", () => {
    expect(parseCheckoutDetails(valid)).toEqual({
      ok: true,
      value: {
        contactName: "Jane Doe",
        contactEmail: "jane@example.com",
        contactPhone: null,
        addressLine1: "1 High Street",
        addressLine2: null,
        city: "Leeds",
        postcode: "LS1 1AA",
      },
    });
  });

  it("names the first invalid field", () => {
    expect(parseCheckoutDetails({ ...valid, contactEmail: "nope" })).toEqual({
      ok: false,
      error: "Please enter a valid email address",
    });
    expect(parseCheckoutDetails({ ...valid, postcode: "12345" })).toEqual({
      ok: false,
      error: "Please enter a valid UK postcode",
    });
    expect(parseCheckoutDetails(null).ok).toBe(false);
  });
});
