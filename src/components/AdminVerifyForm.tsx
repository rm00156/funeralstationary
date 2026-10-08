"use client";

import { useEffect, useRef } from "react";
import { LogIn } from "lucide-react";

/**
 * Posts an admin sign-in token to /api/admin/verify the moment the page has
 * loaded, so the admin isn't asked to click twice. It's a script rather than
 * the link itself because mail scanners fetch every link in an email: they
 * read the page but don't run it, so the single-use token survives them.
 * The button is the fallback when the script doesn't run.
 */
export default function AdminVerifyForm({ token }: { token: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    // Strict mode runs effects twice in development; one POST spends the token.
    if (submitted.current) return;
    submitted.current = true;
    formRef.current?.requestSubmit();
  }, []);

  return (
    <form
      ref={formRef}
      method="post"
      action="/api/admin/verify"
      className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-8 ambient-shadow"
    >
      <input type="hidden" name="token" value={token} />
      <p className="font-body text-on-surface" aria-live="polite">
        Signing you in…
      </p>
      <button type="submit" className="btn btn-outline mt-6 min-h-11 w-full">
        <LogIn size={16} aria-hidden />
        Not moving? Sign in
      </button>
    </form>
  );
}
