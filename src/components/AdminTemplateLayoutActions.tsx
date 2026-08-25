"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eraser, Undo2, UploadCloud } from "lucide-react";

import { adminMutate } from "@/lib/adminClient";
import type { LayoutAction } from "@/lib/adminValidation";

/**
 * The three non-editing operations on a template's layout: publish the draft
 * to customers, throw the draft away, or remove the authored layout entirely
 * (falling back to the generic starter pages).
 */
export default function AdminTemplateLayoutActions({
  slug,
  hasLayout,
  hasDraftLayout,
}: {
  slug: string;
  hasLayout: boolean;
  hasDraftLayout: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<LayoutAction | null>(null);

  const run = async (action: LayoutAction, confirmation?: string) => {
    if (confirmation && !window.confirm(confirmation)) return;
    setBusy(action);
    const message = await adminMutate(`/api/admin/templates/${slug}/layout`, "POST", {
      action,
    });
    setBusy(null);
    if (message) window.alert(message);
    else router.refresh();
  };

  const secondary =
    "flex items-center gap-2 rounded-lg border-2 border-outline-variant px-5 py-2 font-body text-sm font-medium text-on-surface-variant transition-colors duration-300 hover:border-primary-container hover:text-primary disabled:opacity-60";

  return (
    <>
      {hasDraftLayout && (
        <>
          <button
            type="button"
            onClick={() => void run("publish")}
            disabled={busy !== null}
            className="flex items-center gap-2 rounded-lg bg-primary-container px-5 py-2 font-body text-sm font-medium text-white transition-colors duration-300 hover:bg-primary disabled:opacity-60"
          >
            <UploadCloud size={16} aria-hidden />
            {busy === "publish" ? "Publishing…" : "Publish layout"}
          </button>
          <button
            type="button"
            onClick={() =>
              void run(
                "discard",
                "Discard the unpublished layout changes? The live layout stays as it is.",
              )
            }
            disabled={busy !== null}
            className={secondary}
          >
            <Undo2 size={16} aria-hidden />
            {busy === "discard" ? "Discarding…" : "Discard draft"}
          </button>
        </>
      )}
      {hasLayout && (
        <button
          type="button"
          onClick={() =>
            void run(
              "clear",
              "Remove this template's authored layout? Customers will get the generic starter pages instead.",
            )
          }
          disabled={busy !== null}
          className={secondary}
        >
          <Eraser size={16} aria-hidden />
          {busy === "clear" ? "Clearing…" : "Clear layout"}
        </button>
      )}
    </>
  );
}
