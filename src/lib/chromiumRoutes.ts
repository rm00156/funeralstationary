/**
 * Every route that launches headless Chromium (`launchHeadlessBrowser`), as
 * Next route paths. On Vercel, @sparticuz/chromium unpacks its browser from
 * `node_modules/@sparticuz/chromium/bin/*.br`, a directory it finds through
 * `import.meta.url` at run time — invisible to Next's file tracer, which
 * copies the package's JS into the function and leaves the binary behind
 * ("The input directory … does not exist"). next.config.ts adds `bin` to
 * these routes' traces by hand.
 *
 * Only these routes: the binary is 66MB, too heavy to add to every function.
 * chromiumRoutes.test.ts walks the import graph and fails when a route that
 * reaches the launcher is missing here.
 */
export const CHROMIUM_ROUTES = [
  "/api/proof",
  "/api/checkout/return",
  "/api/stripe/webhook",
  "/api/thintent/webhook",
  "/api/thintent/press/[orderId]/[itemId]",
  "/api/admin/templates/[slug]",
  "/api/admin/templates/[slug]/layout",
  "/api/admin/orders/[id]/proofs/[proofId]/pdf",
  "/api/admin/orders/[id]/items/[itemId]/proof",
] as const;

export const CHROMIUM_BINARY_GLOB = "./node_modules/@sparticuz/chromium/bin/**";

/**
 * A route path as an `outputFileTracingIncludes` key. Keys are picomatch
 * globs, where `[slug]` would be a character class matching one letter.
 */
export function routeGlob(route: string): string {
  return route.replace(/[[\]()]/g, (char) => `\\${char}`);
}

export function chromiumTracingIncludes(): Record<string, string[]> {
  return Object.fromEntries(
    CHROMIUM_ROUTES.map((route) => [routeGlob(route), [CHROMIUM_BINARY_GLOB]]),
  );
}
