"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";

import { adminMutate } from "@/lib/adminClient";

/**
 * Permanently remove a template. The catalogue's rule is retire-don't-delete
 * (see adminCatalogue.server.ts) — this is only for a template no customer has
 * ever designed from, typically a templates:generate draft that didn't make the
 * cut. The server does the deciding: a template with designs behind it comes
 * back 409 with the "archive it instead" message, which the dialog keeps open
 * to show rather than dropping the admin back to the page with no explanation.
 */
export default function AdminTemplateDeleteButton({
  slug,
  name,
}: {
  slug: string;
  name: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Escape closes it, matching the editor's preview modal. Mid-delete the
  // dialog is the only thing reporting progress, so it stays put.
  useEffect(() => {
    if (!confirming) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleting) setConfirming(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirming, deleting]);

  // Land on Cancel, not Delete: Enter on an unread dialog shouldn't destroy a row.
  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  const open = () => {
    setError(null);
    setConfirming(true);
  };

  const remove = async () => {
    setDeleting(true);
    setError(null);
    const message = await adminMutate(`/api/admin/templates/${slug}`, "DELETE");
    if (message) {
      setError(message);
      setDeleting(false);
      return;
    }
    router.replace("/admin/templates");
    router.refresh();
  };

  return (
    <>
      <div className="mt-8 rounded-xl border border-outline-variant/40 bg-surface-container-low p-6">
        <h2 className="font-display text-lg font-semibold text-on-surface">
          Delete this template
        </h2>
        <p className="mt-2 max-w-2xl font-body text-sm text-on-surface-variant">
          Only possible while no customer design uses it — a template with orders or
          designs behind it must be archived instead, so that history keeps reading.
          Deleting removes the row, its layout and its category links for good.
        </p>
        <button
          type="button"
          onClick={open}
          className="mt-4 flex items-center gap-2 rounded-lg border-2 border-outline-variant px-5 py-2 font-body text-sm font-medium text-on-surface-variant transition-colors duration-300 hover:border-primary hover:text-primary"
        >
          <Trash2 size={16} aria-hidden />
          Delete template
        </button>
      </div>

      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-template-heading"
          className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/70 p-6"
          onClick={() => {
            if (!deleting) setConfirming(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-xl bg-surface p-6 ambient-shadow"
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              id="delete-template-heading"
              className="font-display text-xl font-semibold text-primary"
            >
              Delete “{name}”?
            </h2>
            <p className="mt-3 font-body text-sm text-on-surface-variant">
              This removes the template, its layout and its category links for good,
              and can&rsquo;t be undone. If it has ever been used, archive it instead.
            </p>
            {error && (
              <p
                role="alert"
                className="mt-4 rounded-lg bg-surface-container-low px-4 py-3 font-body text-sm text-primary"
              >
                {error}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                ref={cancelRef}
                type="button"
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="rounded-lg border-2 border-outline-variant px-5 py-2 font-body text-sm font-medium text-on-surface-variant transition-colors duration-300 hover:border-primary-container hover:text-primary disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void remove()}
                disabled={deleting}
                className="flex items-center gap-2 rounded-lg bg-primary-container px-5 py-2 font-body text-sm font-medium text-white transition-colors duration-300 hover:bg-primary disabled:opacity-60"
              >
                <Trash2 size={16} aria-hidden />
                {deleting ? "Deleting…" : "Delete template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
