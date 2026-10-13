"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Pencil, ShoppingBag, Trash2 } from "lucide-react";

import { useConfirmDialog } from "@/components/ConfirmDialog";
import PreOrderCheckDialog, {
  parsePreOrderCheck,
  type PreOrderCheck,
} from "@/components/PreOrderCheckDialog";
import { changedWhen } from "@/lib/accountOrders";

export interface SavedDesignSummary {
  id: string;
  name: string;
  pageCount: number;
  updatedAt: string;
  templateName: string;
  /** The template's preview — the thumbnail. */
  templateImage: string;
  productLabel: string;
}

export default function SavedDesignList({
  initialDesigns,
}: {
  initialDesigns: SavedDesignSummary[];
}) {
  const router = useRouter();
  const [designs, setDesigns] = useState(initialDesigns);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { confirm, prompt, dialog } = useConfirmDialog();
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
    const next = await prompt({
      title: "Rename this design",
      label: "Design name",
      defaultValue: design.name,
      confirmLabel: "Rename",
    });
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
    const confirmed = await confirm({
      title: `Remove “${design.name}”?`,
      message: "This cannot be undone.",
      confirmLabel: "Remove",
      cancelLabel: "Keep it",
    });
    if (!confirmed) return;

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
      <div className="flex flex-col items-center gap-5 rounded-xl border border-line bg-surface p-10 text-center">
        <FileText size={28} strokeWidth={1.6} className="text-ink-label" aria-hidden />
        <p className="text-ink-2">You haven’t saved a design yet.</p>
        <Link href="/shop" className="btn btn-primary min-h-12">
          Browse designs
        </Link>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-4 text-base font-medium text-plum">
          {error}
        </p>
      )}
      <ul className="flex flex-col gap-4">
        {designs.map((design) => {
          const busy = busyId === design.id;
          return (
            <li
              key={design.id}
              className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-xl border border-line bg-surface p-5 sm:px-7"
            >
              <div className="relative h-[88px] w-[64px] shrink-0 overflow-hidden rounded border border-line bg-sheet">
                <Image
                  src={design.templateImage}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
              <div className="flex min-w-[200px] flex-1 flex-col gap-0.5">
                <h3 className="text-lg font-semibold text-ink">{design.name}</h3>
                <p className="text-base text-ink-2">
                  {design.productLabel} · {design.templateName}
                </p>
                <p className="text-[15px] text-ink-3">
                  Last changed {changedWhen(new Date(design.updatedAt), new Date())}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                <Link href={`/design?design=${design.id}`} className="btn btn-primary min-h-12 px-6">
                  Continue
                </Link>
                <button
                  type="button"
                  onClick={() => addToBasket(design)}
                  disabled={busy}
                  className="btn btn-ghost min-h-12 gap-2 px-3.5 text-base"
                >
                  <ShoppingBag size={18} aria-hidden />
                  Add to basket
                </button>
                <button
                  type="button"
                  onClick={() => rename(design)}
                  disabled={busy}
                  aria-label={`Rename ${design.name}`}
                  className="btn btn-ghost min-h-12 px-3 text-ink-2"
                >
                  <Pencil size={18} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => remove(design)}
                  disabled={busy}
                  aria-label={`Delete ${design.name}`}
                  className="btn btn-ghost min-h-12 px-3 text-ink-2"
                >
                  <Trash2 size={18} aria-hidden />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {preOrderCheck && (
        <PreOrderCheckDialog
          check={preOrderCheck.check}
          busy={busyId === preOrderCheck.designId}
          onConfirm={confirmAdd}
          onClose={() => setPreOrderCheck(null)}
        />
      )}
      {dialog}
    </div>
  );
}
