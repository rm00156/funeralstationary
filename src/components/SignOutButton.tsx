"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";

export default function SignOutButton({ className = "text-sm" }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const signOut = async () => {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={() => void signOut()}
      disabled={busy}
      className={`inline-flex cursor-pointer items-center gap-1.5 font-body text-ink-2 transition-colors hover:text-plum disabled:opacity-60 ${className}`}
    >
      <LogOut size={14} aria-hidden />
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
