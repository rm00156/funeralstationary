"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Pencil, ShoppingBag, Trash2 } from "lucide-react";

import PreOrderCheckDialog, {
  parsePreOrderCheck,
  type PreOrderCheck,
} from "@/components/PreOrderCheckDialog";

export interface SavedDesignSummary {
  id: string;
  name: string;
  pageCount: number;
  updatedAt: string;
  templateName: string;
  productLabel: string;
}

const formatUpdated = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

export default function SavedDesignList({
  initialDesigns,
}: {
  initialDesigns: SavedDesignSummary[];
}) {
  const router = useRouter();
  const [designs, setDesigns] = useState(initialDesigns);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * The refused pre-order check, and the design it was refused for — the
   * confirmation has to re-send the add, so both are needed to retry.
   */
  const [preOrderCheck, setPreOrderCheck] = useState<
    { check: PreOrderCheck; designId: string } | null
  >(null);

  const addToBasket = async (design: SavedDesignSummary, acknowledgeDefaults = false) => {
    setBusyId(design.id);
    setError(null);
    try {
      const response = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId: design.id, acknowledgeDefaults }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        // The pre-order check refusing an add is actionable, not an error:
        // show the customer the list rather than a red sentence.
        const check = parsePreOrderCheck(body);
        if (check) {
          setBusyId(null);
          setPreOrderCheck({ check, designId: design.id });
          return;
        }
        throw new Error(body.error);
      }
      setPreOrderCheck(null);
      window.dispatchEvent(new Event("tfs:cart-changed"));
      router.push("/cart");
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "Could not add that design to your basket — please try again.",
      );
      setBusyId(null);
    }
  };

  /** Re-send the add, this time carrying the customer's confirmation. */
  const confirmAdd = () => {
    if (!preOrderCheck) return;
    const design = designs.find((item) => item.id === preOrderCheck.designId);
    if (design) void addToBasket(design, true);
  };

  const rename = async (design: SavedDesignSummary) => {
    const next = window.prompt("Rename this design", design.name);
    if (next === null) return;
    const name = next.trim();
    if (!name || name === design.name) return;

    setBusyId(design.id);
    setError(null);
    try {
      const response = await fetch(`/api/designs/${design.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error();
      setDesigns((current) =>
        current.map((item) => (item.id === design.id ? { ...item, name } : item)),
      );
    } catch {
      setError("Could not rename that design — please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (design: SavedDesignSummary) => {
    if (!window.confirm(`Remove “${design.name}”? This cannot be undone.`)) return;

    setBusyId(design.id);
    setError(null);
    try {
      const response = await fetch(`/api/designs/${design.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setDesigns((current) => current.filter((item) => item.id !== design.id));
    } catch {
      setError("Could not remove that design — please try again.");
    } finally {
      setBusyId(null);
    }
  };

  if (!designs.length) {
    return (
      <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-10 text-center">
        <FileText size={28} className="mx-auto mb-4 text-on-surface-variant" aria-hidden />
        <p className="font-body text-base text-on-surface-variant mb-6">
          You have not saved a design yet.
        </p>
        <Link
          href="/templates"
          className="inline-flex items-center rounded-lg bg-primary px-5 py-3 font-body text-sm font-medium text-on-primary transition-colors hover:bg-on-primary-container"
        >
          Browse templates
        </Link>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-4 font-body text-sm text-error">
          {error}
        </p>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {designs.map((design) => (
          <li
            key={design.id}
            className="flex flex-col rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5"
          >
            <h2 className="font-display text-xl font-semibold text-on-surface mb-1">
              {design.name}
            </h2>
            <p className="font-body text-sm text-on-surface-variant">
              {design.templateName} · {design.productLabel}
            </p>
            <p className="font-body text-sm text-on-surface-variant mb-5">
              {design.pageCount} pages · saved {formatUpdated(design.updatedAt)}
            </p>

            <div className="mt-auto flex items-center gap-2">
              <Link
                href={`/design?design=${design.id}`}
                className="flex-1 rounded-lg bg-secondary px-4 py-2.5 text-center font-body text-sm font-medium text-on-secondary transition-colors hover:bg-on-secondary-container"
              >
                Open
              </Link>
              <button
                type="button"
                onClick={() => addToBasket(design)}
                disabled={busyId === design.id}
                aria-label={`Add ${design.name} to basket`}
                className="rounded-lg p-2.5 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary disabled:opacity-50"
              >
                <ShoppingBag size={18} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => rename(design)}
                disabled={busyId === design.id}
                aria-label={`Rename ${design.name}`}
                className="rounded-lg p-2.5 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary disabled:opacity-50"
              >
                <Pencil size={18} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => remove(design)}
                disabled={busyId === design.id}
                aria-label={`Remove ${design.name}`}
                className="rounded-lg p-2.5 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-error disabled:opacity-50"
              >
                <Trash2 size={18} aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {preOrderCheck && (
        <PreOrderCheckDialog
          check={preOrderCheck.check}
          busy={busyId === preOrderCheck.designId}
          onConfirm={confirmAdd}
          onClose={() => setPreOrderCheck(null)}
        />
      )}
    </div>
  );
}
