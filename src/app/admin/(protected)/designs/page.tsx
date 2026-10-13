import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";

import AdminDesignTable from "@/components/AdminDesignTable";
import { parseSearch } from "@/lib/adminDashboard";
import { adminDesignHref, designReference } from "@/lib/adminDesigns";
import {
  ADMIN_DESIGN_LIST_LIMIT,
  adminDesignExists,
  adminListDesigns,
} from "@/lib/adminDesigns.server";

export const dynamic = "force-dynamic";

export default async function AdminDesignsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  // A pasted link (or id) goes straight to that design. Read before
  // parseSearch, which would cut a long link short.
  const reference = designReference(q);
  if (reference && (await adminDesignExists(reference))) redirect(adminDesignHref(reference));

  const query = parseSearch(q);
  const designs = await adminListDesigns({ query });

  return (
    <>
      <h1 className="mb-2 font-display text-3xl font-medium text-plum-deep">Designs</h1>
      <p className="mb-6 max-w-2xl font-body text-ink-2">
        Customers&rsquo; designs, most recently changed first. If someone is stuck, open
        their design and make the change for them — it saves to their own design, and
        they&rsquo;ll see it next time they open it. Ask them to close the editor first,
        or their open copy will need reloading.
      </p>

      <form role="search" action="/admin/designs" className="mb-4 flex max-w-xl gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Search designs</span>
          <Search
            size={18}
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-label"
          />
          <input
            type="search"
            name="q"
            defaultValue={query ?? ""}
            placeholder="Their link, email, or a name on the design"
            className="field min-h-11 pl-10 text-base"
          />
        </label>
        <button type="submit" className="btn btn-primary min-h-11 px-5 text-base">
          Search
        </button>
      </form>
      <p className="mb-6 max-w-2xl font-body text-sm text-ink-2">
        A guest has no account to look up: ask them for the link from their editor&rsquo;s
        share button, or search for the name of the person the stationery is for.
      </p>

      {query && (
        <p className="mb-4 font-body text-sm text-ink-2" role="status">
          {designs.length === 0
            ? reference
              ? "That link or id isn’t a design — or the design has been deleted."
              : `No designs match “${query}”.`
            : `${designs.length}${designs.length === ADMIN_DESIGN_LIST_LIMIT ? "+" : ""} ${designs.length === 1 ? "design matches" : "designs match"} “${query}”.`}{" "}
          <Link href="/admin/designs" className="link">
            Clear search
          </Link>
        </p>
      )}

      {!query && designs.length === ADMIN_DESIGN_LIST_LIMIT && (
        <p className="mb-4 font-body text-sm text-ink-2" role="status">
          Showing the {ADMIN_DESIGN_LIST_LIMIT} most recently changed — search to find an older one.
        </p>
      )}

      <AdminDesignTable
        designs={designs}
        empty={query ? "Nothing found — try their email, or the name of the person it’s for." : "No designs yet."}
      />
    </>
  );
}
