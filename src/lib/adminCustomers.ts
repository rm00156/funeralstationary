/**
 * Who the customers are, for /admin/customers. There is no customers table:
 * most people order as guests, so a customer is an email address — the one
 * they signed in with when the order is on an account, otherwise the contact
 * email they typed at checkout. Accounts that have never ordered are
 * customers too (they have saved designs). Pure and unit-tested;
 * adminCustomers.server.ts loads the rows.
 */

export interface CustomerOrderRow {
  id: string;
  orderNumber: string;
  userId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  postcode: string | null;
  totalPence: number;
  placedAt: Date | null;
  createdAt: Date;
}

export interface CustomerAccountRow {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
}

export interface CustomerSummary {
  /** The lowercased email — the customer's identity, and their page's URL. */
  email: string;
  name: string | null;
  phone: string | null;
  postcode: string | null;
  orderCount: number;
  spentPence: number;
  firstOrderAt: Date | null;
  lastOrderAt: Date | null;
  account: { id: string; createdAt: Date } | null;
  /** Every order number, so a search for one finds its customer. */
  orderNumbers: string[];
}

export const customerKey = (email: string) => email.trim().toLowerCase();

/** The customer page for an email. */
export const customerHref = (email: string) => `/admin/customers/${encodeURIComponent(customerKey(email))}`;

/** The email an order belongs to: its account's, else the one typed at checkout. */
export function orderCustomerEmail(
  order: Pick<CustomerOrderRow, "userId" | "contactEmail">,
  accountEmails: ReadonlyMap<string, string>,
): string | null {
  const email = (order.userId && accountEmails.get(order.userId)) || order.contactEmail;
  return email ? customerKey(email) : null;
}

/**
 * One row per customer, most recent order first; accounts that have never
 * ordered follow, newest first. Name, phone and postcode come from the
 * customer's latest order — what they last told us.
 */
export function groupCustomers(
  orderRows: readonly CustomerOrderRow[],
  accounts: readonly CustomerAccountRow[],
): CustomerSummary[] {
  const accountEmails = new Map(accounts.map((account) => [account.id, account.email]));
  const accountByEmail = new Map(accounts.map((account) => [customerKey(account.email), account]));
  const byEmail = new Map<string, CustomerSummary>();
  const when = (order: CustomerOrderRow) => order.placedAt ?? order.createdAt;

  // Oldest first, so each later order overwrites the contact details.
  const sorted = [...orderRows].sort((a, b) => when(a).getTime() - when(b).getTime());
  for (const order of sorted) {
    const email = orderCustomerEmail(order, accountEmails);
    if (!email) continue;
    const account = accountByEmail.get(email);
    const customer = byEmail.get(email) ?? {
      email,
      name: null,
      phone: null,
      postcode: null,
      orderCount: 0,
      spentPence: 0,
      firstOrderAt: when(order),
      lastOrderAt: null,
      account: account ? { id: account.id, createdAt: account.createdAt } : null,
      orderNumbers: [],
    };
    customer.name = order.contactName?.trim() || customer.name;
    customer.phone = order.contactPhone?.trim() || customer.phone;
    customer.postcode = order.postcode?.trim() || customer.postcode;
    customer.orderCount += 1;
    customer.spentPence += order.totalPence;
    customer.lastOrderAt = when(order);
    customer.orderNumbers.push(order.orderNumber);
    byEmail.set(email, customer);
  }

  const withOrders = [...byEmail.values()].sort(
    (a, b) => (b.lastOrderAt?.getTime() ?? 0) - (a.lastOrderAt?.getTime() ?? 0),
  );
  const accountsOnly = accounts
    .filter((account) => !byEmail.has(customerKey(account.email)))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(
      (account): CustomerSummary => ({
        email: customerKey(account.email),
        name: account.name,
        phone: null,
        postcode: null,
        orderCount: 0,
        spentPence: 0,
        firstOrderAt: null,
        lastOrderAt: null,
        account: { id: account.id, createdAt: account.createdAt },
        orderNumbers: [],
      }),
    );
  return [...withOrders, ...accountsOnly];
}

const digits = (value: string) => value.replace(/\D/g, "");
const squash = (value: string) => value.replace(/\s+/g, "").toLowerCase();

/**
 * Whether a customer matches the search box: any part of their name or
 * email, their phone or postcode however it was spaced, or one of their
 * order numbers.
 */
export function matchesCustomer(customer: CustomerSummary, query: string): boolean {
  const q = squash(query);
  if (!q) return true;
  const text = [customer.name ?? "", customer.email, customer.postcode ?? "", ...customer.orderNumbers];
  if (text.some((value) => squash(value).includes(q))) return true;
  const phoneQuery = digits(query);
  return phoneQuery.length >= 4 && customer.phone !== null && digits(customer.phone).includes(phoneQuery);
}
