"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function AdminLogoutButton() {
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={logout}
      className="flex items-center gap-2 rounded-lg px-3 py-2 font-body text-sm font-medium text-on-surface-variant transition-colors duration-300 hover:bg-surface-container hover:text-primary"
    >
      <LogOut size={16} aria-hidden />
      Sign out
    </button>
  );
}
