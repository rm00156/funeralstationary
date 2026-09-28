import { char, index, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * A customer account is an email address that has been proven once by
 * clicking a link we sent to it. There is no password column on purpose:
 * sign-in is always by emailed link (see src/lib/auth.server.ts), so there is
 * nothing to forget, reset or leak.
 */
export const users = mysqlTable("users", {
  id: char("id", { length: 36 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 200 }),
  emailVerifiedAt: timestamp("email_verified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

/**
 * One-time sign-in links. The row holds only a sha256 of the secret that
 * went out in the email, so a read of this table can't be replayed as a
 * link. A token is spent by the atomic conditional update in
 * consumeLoginToken — clicked twice, the second click fails — and it carries
 * its own destination so the URL can't be used as an open redirect.
 *
 * Keyed by email rather than user: the users row is created when the link
 * is *clicked*, never when it is requested, so typing a stranger's address
 * into the form creates nothing on their behalf.
 */
export const loginTokens = mysqlTable(
  "login_tokens",
  {
    id: char("id", { length: 36 }).primaryKey(),
    tokenHash: char("token_hash", { length: 64 }).notNull().unique(),
    email: varchar("email", { length: 255 }).notNull(),
    /** Site-relative path to land on after signing in. */
    redirectTo: varchar("redirect_to", { length: 512 }).notNull().default("/account"),
    expiresAt: timestamp("expires_at").notNull(),
    consumedAt: timestamp("consumed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("login_tokens_email_idx").on(t.email, t.createdAt)],
);
