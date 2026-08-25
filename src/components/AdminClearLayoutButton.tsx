"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eraser } from "lucide-react";

import { adminMutate } from "@/lib/adminClient";

/** Clears templates.layout so the template falls back to the generic starter. */
export default function AdminClearLayoutButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [clearing, setClearing] = useState(false);

  const clear = async () => {
    const confirmed = window.confirm(
      "Remove this template's authored layout? Customers will get the generic starter pages instead.",
    );
    if (!confirmed) return;
    setClearing(true);
    const message = await adminMutate(`/api/admin/templates/${slug}/layout`, "PUT", {
      pages: null,
    });
    setClearing(false);
    if (message) window.alert(message);
    else router.refresh();
  };

  return (
    <button
      type="button"
      onClick={clear}
      disabled={clearing}
      className="flex items-center gap-2 rounded-lg border-2 border-outline-variant px-5 py-2 font-body text-sm font-medium text-on-surface-variant transition-colors duration-300 hover:border-primary-container hover:text-primary disabled:opacity-60"
    >
      <Eraser size={16} aria-hidden />
      {clearing ? "Clearing…" : "Clear layout"}
    </button>
  );
}
