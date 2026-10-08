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
    // submit(), not requestSubmit(): it works in every browser (Safari < 16
    // lacks requestSubmit) and fires no submit event for the guard below.
    formRef.current?.submit();
  }, []);

  return (
    <form
      ref={formRef}
      method="post"
      action="/api/admin/verify"
      // Once the automatic POST is on its way, a click would send the token a
      // second time and abandon the response carrying the sign-in cookie.
      onSubmit={(event) => {
        if (submitted.current) event.preventDefault();
      }}
      className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-8 ambient-shadow"
    >
      <input type="hidden" name="token" value={token} />
      <p className="font-body text-on-surface" aria-live="polite">
        Signing you in…
      </p>
      <button type="submit" className="btn btn-outline mt-6 min-h-11 w-full">
        <LogIn size={16} aria-hidden />
        Sign in
      </button>
    </form>
  );
}
