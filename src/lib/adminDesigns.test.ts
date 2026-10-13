import { describe, expect, it } from "vitest";
import { designOrderState, designOwner, designOwnerLabel, designReference } from "./adminDesigns";

const ID = "3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c";

describe("designReference", () => {
  it("takes the id from the link a customer copies out of their editor", () => {
    expect(
      designReference(`https://funeralstationary.vercel.app/design?design=${ID}&quantity=q50`),
    ).toBe(ID);
  });

  it("takes a bare id, an admin link, and upper-case or padded input", () => {
    expect(designReference(ID)).toBe(ID);
    expect(designReference(`  /admin/designs/${ID.toUpperCase()}  `)).toBe(ID);
  });

  it("treats names, emails and order numbers as a search, not a reference", () => {
    expect(designReference("Margaret Smith")).toBeNull();
    expect(designReference("someone@example.com")).toBeNull();
    expect(designReference("TFS-2026-123456")).toBeNull();
    expect(designReference(undefined)).toBeNull();
  });
});

describe("designOrderState", () => {
  it("is neither in a basket nor ordered with no order lines", () => {
    expect(designOrderState([])).toEqual({ inBasket: false, orders: [] });
  });

  it("separates the basket from orders already paid for", () => {
    expect(
      designOrderState([
        { orderId: "a", orderNumber: "TFS-2026-000001", status: "draft" },
        { orderId: "b", orderNumber: "TFS-2026-000002", status: "awaiting_print" },
        { orderId: "c", orderNumber: "TFS-2026-000003", status: "cancelled" },
      ]),
    ).toEqual({
      inBasket: true,
      orders: [
        { id: "b", orderNumber: "TFS-2026-000002" },
        { id: "c", orderNumber: "TFS-2026-000003" },
      ],
    });
  });

  it("lists an order once even when the design is on two of its lines", () => {
    const line = { orderId: "b", orderNumber: "TFS-2026-000002", status: "delivered" };
    expect(designOrderState([line, line]).orders).toHaveLength(1);
  });
});

describe("designOwnerLabel", () => {
  it("names an account by its name, else its email", () => {
    expect(designOwnerLabel({ name: "Jean Brown", email: "jean@example.com" })).toBe("Jean Brown");
    expect(designOwnerLabel({ name: "  ", email: "jean@example.com" })).toBe("jean@example.com");
    expect(designOwnerLabel({ name: null, email: "jean@example.com" })).toBe("jean@example.com");
  });

  it("calls an unclaimed design a guest's", () => {
    expect(designOwnerLabel(null)).toBe("a guest");
  });
});

describe("designOwner", () => {
  it("is the account when the design has one", () => {
    expect(designOwner({ userId: "u1", guestToken: null })).toEqual({ userId: "u1", guestToken: null });
  });

  it("is the guest otherwise", () => {
    expect(designOwner({ userId: null, guestToken: "g1" })).toEqual({ userId: null, guestToken: "g1" });
  });

  it("is no one for a row with neither", () => {
    expect(designOwner({ userId: null, guestToken: null })).toBeNull();
  });
});
