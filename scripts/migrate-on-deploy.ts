/**
 * The migration step of `vercel-build`, with a guard on WHICH deploy is
 * allowed to run it.
 *
 * Vercel runs `vercel-build` for every deployment, preview deployments of any
 * pushed branch included. An unguarded `db:migrate && next build` would let a
 * branch carrying an unreleased migration migrate whatever database the build
 * can see — and if DATABASE_URL is ever scoped to Preview as well as
 * Production, that is the production database, moved forward while it still
 * serves the previous release's code. (This happened for real in the sibling
 * thintent repo, which is where this script comes from.)
 *
 * Scoping DATABASE_URL to Production only in Vercel's settings is the real
 * fix. This is the seatbelt: even with a mis-scoped variable, only a
 * production deploy may migrate.
 *
 * `VERCEL_ENV` is set by Vercel itself to "production", "preview" or
 * "development" — not something a branch can talk its way past. Absent
 * entirely means this isn't a Vercel build at all (a local
 * `npm run vercel-build`), and local work should go through
 * `npm run db:migrate` deliberately rather than as a side effect of a build.
 *
 * If a preview environment is ever given its OWN database, set
 * ALLOW_PREVIEW_MIGRATIONS=1 on that environment to migrate it too. Never set
 * it anywhere that can see production.
 */

export type MigrateDecision = { run: true } | { run: false; reason: string };

/**
 * Whether this deploy may run migrations. Pure, so the rule can be tested
 * without a build: everything it needs arrives in `env`.
 */
export function migrateDecision(env: Record<string, string | undefined>): MigrateDecision {
  const vercelEnv = env.VERCEL_ENV;

  if (!vercelEnv) {
    return {
      run: false,
      reason:
        "not a Vercel build (VERCEL_ENV unset) — run `npm run db:migrate` directly if you meant to migrate",
    };
  }

  if (vercelEnv === "production") return { run: true };

  // Checked only off the production path, so the opt-in can never be the
  // thing that lets a preview reach the production database.
  if (env.ALLOW_PREVIEW_MIGRATIONS === "1") return { run: true };

  return {
    run: false,
    reason: `VERCEL_ENV is "${vercelEnv}", not "production" — skipping migrations so a non-production deploy can never move a database forward`,
  };
}

async function main() {
  const decision = migrateDecision(process.env);

  if (!decision.run) {
    console.log(`[migrate-on-deploy] skipped: ${decision.reason}`);
    return;
  }

  console.log("[migrate-on-deploy] production deploy — running drizzle-kit migrate");
  const { execFileSync } = await import("node:child_process");
  // Inherited stdio so drizzle's own output (and any failure) lands in the
  // Vercel build log. A failed migration throws here and fails the build, so
  // new code never goes live against a schema it doesn't match.
  execFileSync("npx", ["drizzle-kit", "migrate"], { stdio: "inherit" });
}

// Only run when invoked as the script, so the test can import the rule alone.
if (process.argv[1] && process.argv[1].includes("migrate-on-deploy")) {
  main().catch((err) => {
    console.error("[migrate-on-deploy] failed:", err);
    process.exit(1);
  });
}
