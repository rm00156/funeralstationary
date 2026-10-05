import { redirect } from "next/navigation";

import { getSellableProducts } from "@/lib/catalogue.server";

export const dynamic = "force-dynamic";

/**
 * /templates used to be a cross-product template browser. A product's designs
 * now live on its own page (/products/[slug], filtered by ?category=), so the
 * old address forwards there — old bookmarks, and the "browse templates"
 * links in the basket and the account page, still land somewhere useful. An
 * unknown or missing product goes to the shop.
 */
export default async function TemplatesPage({
  searchParams,
}: PageProps<"/templates">) {
  const [{ product, category }, products] = await Promise.all([
    searchParams,
    getSellableProducts(),
  ]);
  const match = products.find((candidate) => candidate.id === product);
  if (!match) redirect("/shop");
  redirect(
    typeof category === "string"
      ? `/products/${match.id}?category=${encodeURIComponent(category)}`
      : `/products/${match.id}`,
  );
}
