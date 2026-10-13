import { describe, expect, it } from "vitest";
import {
  FUNERAL_VOLUMES,
  tradeApplicationEmail,
  tradeOrderTypes,
  validateTradeApplication,
} from "@/lib/tradeApplication";

const orderTypes = tradeOrderTypes([
  { id: "order-of-service", label: "Order of Service Booklets" },
  { id: "bookmark", label: "Bookmarks" },
]);

const valid = {
  businessName: "  Hollis & Daughters Funeral Directors ",
  postcode: "br3 1qz",
  name: "Sam Hollis",
  role: "arranger",
  email: "sam@hollis.example",
  phone: "020 7946 0000",
  volume: "5-15",
  orders: ["bookmark", "order-of-service"],
  notes: "",
};

describe("tradeOrderTypes", () => {
  it("lists the products, then Something else", () => {
    expect(orderTypes.map(({ id }) => id)).toEqual(["order-of-service", "bookmark", "something-else"]);
  });

  it("leaves out a product whose slug would shadow Something else", () => {
    const types = tradeOrderTypes([{ id: "something-else", label: "A product" }]);
    expect(types).toEqual([{ id: "something-else", label: "Something else" }]);
  });
});

describe("validateTradeApplication", () => {
  it("accepts a complete application, trimmed, with choices resolved to their labels", () => {
    expect(validateTradeApplication(valid, orderTypes)).toEqual({
      ok: true,
      application: {
        businessName: "Hollis & Daughters Funeral Directors",
        postcode: "BR3 1QZ",
        name: "Sam Hollis",
        role: "Funeral arranger",
        email: "sam@hollis.example",
        phone: "020 7946 0000",
        volume: "5 to 15",
        // In the form's order, not the order they were ticked.
        orders: ["Order of Service Booklets", "Bookmarks"],
        notes: null,
      },
    });
  });

  it("takes one ticked box as a string, and none at all", () => {
    const one = validateTradeApplication({ ...valid, orders: "bookmark" }, orderTypes);
    expect(one.ok && one.application.orders).toEqual(["Bookmarks"]);
    const none = validateTradeApplication({ ...valid, orders: undefined }, orderTypes);
    expect(none.ok && none.application.orders).toEqual([]);
  });

  it("takes the role from the list, or the applicant's own words for Other", () => {
    const listed = validateTradeApplication(valid, orderTypes);
    expect(listed.ok && listed.application.role).toBe("Funeral arranger");
    const other = validateTradeApplication({ ...valid, role: "other", roleOther: "  Bereavement coordinator " }, orderTypes);
    expect(other.ok && other.application.role).toBe("Bereavement coordinator");
  });

  it("needs the applicant's own words when they choose Other, and ignores them otherwise", () => {
    const missing = validateTradeApplication({ ...valid, role: "other", roleOther: " " }, orderTypes);
    expect(!missing.ok && missing.errors).toEqual({ roleOther: "Please tell us your role." });
    const tooLong = validateTradeApplication({ ...valid, role: "other", roleOther: "x".repeat(121) }, orderTypes);
    expect(!tooLong.ok && tooLong.errors).toEqual({ roleOther: "That role is too long." });
    const ignored = validateTradeApplication({ ...valid, roleOther: "Anything" }, orderTypes);
    expect(ignored.ok && ignored.application.role).toBe("Funeral arranger");
  });

  it("refuses a role the list doesn't offer", () => {
    const result = validateTradeApplication({ ...valid, role: "Funeral arranger" }, orderTypes);
    expect(!result.ok && result.errors).toEqual({ role: "Please choose your role." });
  });

  it("reports every missing required field at once", () => {
    const result = validateTradeApplication({}, orderTypes);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual([
      "businessName",
      "email",
      "name",
      "phone",
      "postcode",
      "role",
      "volume",
    ]);
  });

  it("rejects a malformed email, an unknown volume and a box the form never showed", () => {
    const result = validateTradeApplication(
      { ...valid, email: "sam@", volume: "1000", orders: ["bookmark", "free-money"] },
      orderTypes,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(["email", "orders", "volume"]);
  });

  it("rejects an email that would read as a list of reply-to addresses", () => {
    const result = validateTradeApplication({ ...valid, email: "a@b.example,c@d.example" }, orderTypes);
    expect(result.ok).toBe(false);
  });

  it("rejects over-long fields", () => {
    const result = validateTradeApplication(
      { ...valid, postcode: "BR3 1QZ BR3 1QZ", notes: "x".repeat(5001) },
      orderTypes,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(["notes", "postcode"]);
  });

  it("offers a volume for every select option", () => {
    for (const { id } of FUNERAL_VOLUMES) {
      expect(validateTradeApplication({ ...valid, volume: id }, orderTypes).ok).toBe(true);
    }
  });
});

describe("tradeApplicationEmail", () => {
  const application = {
    businessName: "Hollis <b>& Co</b>",
    postcode: "BR3 1QZ",
    name: "Sam\r\nBcc: someone@example.com",
    role: "Director",
    email: "sam@hollis.example",
    phone: "020 7946 0000",
    volume: "5 to 15",
    orders: [],
    notes: "<script>alert(1)</script>",
  };

  it("escapes everything the applicant typed in the HTML", () => {
    const { html } = tradeApplicationEmail(application);
    expect(html).not.toContain("<b>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("Hollis &lt;b&gt;&amp; Co&lt;/b&gt;");
  });

  it("keeps the subject on one line", () => {
    const { subject } = tradeApplicationEmail(application);
    expect(subject).not.toMatch(/[\r\n]/);
    expect(subject).toContain("Trade account application: Hollis");
  });

  it("tells staff, in the email and its subject, when the address is already on a firm", () => {
    const active = tradeApplicationEmail(application, { firmName: "Hollis & Daughters", isActive: true });
    expect(active.text.startsWith("Already a trade customer: This email is on Hollis & Daughters\n")).toBe(true);
    expect(active.subject).toMatch(/\(already on Hollis & Daughters\)$/);
    const retired = tradeApplicationEmail(application, { firmName: "Hollis & Daughters", isActive: false });
    expect(retired.subject).toMatch(/\(already on Hollis & Daughters \(retired\)\)$/);
    expect(tradeApplicationEmail(application).text).not.toContain("Already a trade customer");
  });

  it("links staff to admin to approve or decline it", () => {
    const { text, html } = tradeApplicationEmail(application, null, "https://tfs.example/admin/trade");
    expect(text).toContain("Approve or decline it in admin: https://tfs.example/admin/trade");
    expect(html).toContain('<a href="https://tfs.example/admin/trade">Approve or decline it in admin</a>');
  });

  it("says when nothing was ticked, and leaves out empty notes", () => {
    const { text } = tradeApplicationEmail({ ...application, notes: null });
    expect(text).toContain("Usually orders: Not given");
    expect(text.trimEnd().endsWith("Usually orders: Not given")).toBe(true);
  });
});
