"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Lock } from "lucide-react";

export default function AdminLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (response.ok) {
        router.push("/admin");
        router.refresh();
        return;
      }
      const { error: message } = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setError(message ?? "Could not sign in — please try again");
    } catch {
      setError("Could not sign in — please try again");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-8 ambient-shadow"
    >
      <label
        htmlFor="admin-password"
        className="block font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary mb-2"
      >
        Admin password
      </label>
      <input
        id="admin-password"
        type="password"
        autoComplete="current-password"
        autoFocus
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className="w-full rounded-lg bg-surface-container-low px-4 py-3 font-body text-base text-on-surface border border-outline-variant transition-colors duration-300 focus:border-primary-container focus:outline-none focus:ring-4 focus:ring-primary-container/15"
      />
      {error && (
        <p role="alert" className="mt-3 font-body text-sm text-primary">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting || !password}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-primary-container px-5 py-3 font-body font-medium tracking-wide text-white transition-colors duration-300 hover:bg-primary disabled:opacity-60"
      >
        <Lock size={16} aria-hidden />
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
