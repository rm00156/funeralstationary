/**
 * The origin every link this site hands out is built on — sign-in emails,
 * admin invitations, Stripe's return URLs, the links sent to Thintent.
 * Pure, no env reads (resolveRequestOrigin in stripe.server.ts passes them
 * in), unit-tested.
 *
 * A request's host headers are whatever the sender wrote: someone could ask
 * for the owner's sign-in link with `X-Forwarded-Host: evil.example`, and the
 * owner would be emailed a genuine token on the attacker's domain. So a
 * configured address wins:
 *
 * 1. `SITE_URL`, when set.
 * 2. On a Vercel production deploy, Vercel's own production domain
 *    (`VERCEL_PROJECT_PRODUCTION_URL`, a system variable Vercel sets) — so
 *    production is covered with nothing to configure.
 * 3. Otherwise the request: `x-forwarded-host`/`-proto` (what ngrok and
 *    Vercel's edge set to the original host) over `request.url`, which only
 *    ever shows what this process is bound to (`localhost` behind a tunnel).
 *    That keeps a dev tunnel and preview deploys working with no setup.
 */
export interface OriginInput {
  siteUrl?: string;
  vercelEnv?: string;
  vercelProductionHost?: string;
  requestUrl: string;
  forwardedHost: string | null;
  forwardedProto: string | null;
}

/** An absolute http(s) URL's origin, or null for anything else. */
function originOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

export function siteOrigin(input: OriginInput): string {
  const siteUrl = input.siteUrl?.trim();
  if (siteUrl) {
    const configured = originOf(siteUrl);
    if (configured) return configured;
    // A typo must not take checkout down; say so loudly and carry on.
    console.error(`SITE_URL is not an absolute http(s) URL (${JSON.stringify(siteUrl)}) — ignoring it.`);
  }
  if (input.vercelEnv === "production" && input.vercelProductionHost) {
    const production = originOf(`https://${input.vercelProductionHost}`);
    if (production) return production;
  }
  if (!input.forwardedHost) return new URL(input.requestUrl).origin;
  const proto = input.forwardedProto?.split(",")[0]?.trim();
  return `${proto ?? "https"}://${input.forwardedHost}`;
}
