import HeaderNav from "@/components/HeaderNav";
import { getSellableProducts } from "@/lib/catalogue.server";
import { getCurrentUser } from "@/lib/auth.server";
import { authConfigured } from "@/lib/userSession";

/**
 * The site header. A server component so the shop menu is built from the
 * live catalogue — every sellable product gets an entry under its occasion
 * group, and a product set up later in /admin appears here without a code
 * change. getSellableProducts
 * is React-cached, so a page that also needs the list pays for one query.
 *
 * It also decides the account button: "Sign in", or "My account" with a
 * menu holding Sign out. getCurrentUser is React-cached too.
 */
export default async function Header() {
  const accountsEnabled = authConfigured();
  const [products, user] = await Promise.all([
    getSellableProducts(),
    accountsEnabled ? getCurrentUser() : null,
  ]);
  return (
    <HeaderNav
      products={products.map(({ id, label, occasion }) => ({ id, label, occasion }))}
      user={user ? { email: user.email } : null}
    />
  );
}
