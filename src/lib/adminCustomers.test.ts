import { describe, expect, it } from "vitest";
import { customerHref, groupCustomers, matchesCustomer, type CustomerOrderRow } from "./adminCustomers";

const row = (overrides: Partial<CustomerOrderRow>): CustomerOrderRow => ({
  id: "o",
  orderNumber: "TFS-2026-000001",
  userId: null,
  contactName: "Jane Okafor",
  contactEmail: "jane@example.com",
  contactPhone: "07700 900123",
  postcode: "BR3 1QZ",
  totalPence: 1000,
  placedAt: new Date("2026-10-01T10:00:00Z"),
  createdAt: new Date("2026-10-01T09:00:00Z"),
  ...overrides,
});

describe("groupCustomers", () => {
  it("groups orders by email case-insensitively, latest details winning", () => {
    const [customer] = groupCustomers(
      [
        row({ id: "1", orderNumber: "A", contactName: "J Okafor", totalPence: 1000 }),
        row({
          id: "2",
          orderNumber: "B",
          contactEmail: " Jane@Example.com ",
          contactName: "Jane Okafor",
          contactPhone: null,
          totalPence: 2500,
          placedAt: new Date("2026-10-05T10:00:00Z"),
        }),
      ],
      [],
    );
    expect(customer).toMatchObject({
      email: "jane@example.com",
      name: "Jane Okafor",
      phone: "07700 900123",
      orderCount: 2,
      spentPence: 3500,
      orderNumbers: ["A", "B"],
      account: null,
    });
    expect(customer.lastOrderAt?.toISOString()).toBe("2026-10-05T10:00:00.000Z");
  });

  it("files an account's orders under the account email, whatever was typed at checkout", () => {
    const customers = groupCustomers(
      [row({ userId: "u1", contactEmail: "work@example.com" })],
      [{ id: "u1", email: "Jane@example.com", name: null, createdAt: new Date("2026-09-01") }],
    );
    expect(customers).toHaveLength(1);
    expect(customers[0]).toMatchObject({ email: "jane@example.com", orderCount: 1, account: { id: "u1" } });
  });

  it("lists accounts that have never ordered after those that have", () => {
    const customers = groupCustomers(
      [row({})],
      [{ id: "u2", email: "new@example.com", name: "New Person", createdAt: new Date("2026-10-07") }],
    );
    expect(customers.map((customer) => [customer.email, customer.orderCount])).toEqual([
      ["jane@example.com", 1],
      ["new@example.com", 0],
    ]);
  });

  it("skips orders with no email at all", () => {
    expect(groupCustomers([row({ contactEmail: null })], [])).toEqual([]);
  });
});

describe("matchesCustomer", () => {
  const [customer] = groupCustomers([row({ orderNumber: "TFS-2026-123456" })], []);

  it("matches name, email, postcode and order number loosely", () => {
    expect(matchesCustomer(customer, "okafor")).toBe(true);
    expect(matchesCustomer(customer, "JANE@")).toBe(true);
    expect(matchesCustomer(customer, "br31qz")).toBe(true);
    expect(matchesCustomer(customer, "123456")).toBe(true);
    expect(matchesCustomer(customer, "mitchell")).toBe(false);
  });

  it("matches a phone number however it is spaced", () => {
    expect(matchesCustomer(customer, "07700900123")).toBe(true);
    expect(matchesCustomer(customer, "900 123")).toBe(true);
  });
});

describe("customerHref", () => {
  it("encodes the lowercased email", () => {
    expect(customerHref("Jane+funeral@Example.com")).toBe("/admin/customers/jane%2Bfuneral%40example.com");
  });
});
