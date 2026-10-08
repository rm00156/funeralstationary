import { boolean, char, index, mysqlEnum, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";

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

export const LOGIN_TOKEN_PURPOSES = ["customer", "admin"] as const;
export type LoginTokenPurpose = (typeof LOGIN_TOKEN_PURPOSES)[number];

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
    /**
     * Which door the link opens. Each verify route spends only its own kind,
     * so an admin link can't sign anyone in as a customer or the reverse.
     */
    purpose: mysqlEnum("purpose", LOGIN_TOKEN_PURPOSES).notNull().default("customer"),
    expiresAt: timestamp("expires_at").notNull(),
    consumedAt: timestamp("consumed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("login_tokens_email_idx").on(t.email, t.createdAt)],
);

/**
 * Who may sign in to /admin — by emailed link, like customers, but with its
 * own cookie and its own list. Keyed by email, not by `users`, because access
 * is granted to an address before its owner has ever signed in, and an admin
 * isn't a customer account.
 *
 * The owner row (`is_owner`) is inserted by migration 0023_admins and can't be
 * removed from the admin area, so the shop can never be left with no one able
 * to sign in.
 */
export const admins = mysqlTable("admins", {
  id: char("id", { length: 36 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  isOwner: boolean("is_owner").notNull().default(false),
  /** The admin who granted access; null for the owner. A snapshot, not a FK. */
  addedBy: varchar("added_by", { length: 255 }),
  lastSignInAt: timestamp("last_sign_in_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
