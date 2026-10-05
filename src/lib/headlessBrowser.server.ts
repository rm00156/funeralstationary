/**
 * Shared headless-Chromium launcher for server-side rendering jobs (proof
 * generation, template thumbnails) — anything that screenshots the real
 * PageCanvas via /proof-render.
 */

/**
 * The origin headless Chromium loads /proof-render from — this server
 * calling itself, so never the public origin a link should carry.
 *
 * Off Vercel it is the address Next itself is listening on, which Next
 * records as `__NEXT_PRIVATE_ORIGIN` (with the real scheme, so
 * `next dev --experimental-https` works) when it records `PORT`.
 * `request.url` can't be trusted for this: Next builds it from the bound
 * `localhost:<port>` but takes the scheme from `x-forwarded-proto`, so a
 * request through a cloudflared/ngrok tunnel yields `https://localhost:3000`,
 * which nothing serves. On Vercel there is no loopback to call, and
 * `request.url` is the deployment's real https origin.
 */
export function renderOrigin(request: Request): string {
  if (process.env.VERCEL) return new URL(request.url).origin;
  return process.env.__NEXT_PRIVATE_ORIGIN ?? `http://localhost:${process.env.PORT ?? 3000}`;
}

/** Vercel's serverless functions run Linux, which @sparticuz/chromium's
 * binary targets; a Mac/Windows dev machine needs a real local Chromium
 * instead, which the full `puppeteer` package downloads on install. */
export async function launchHeadlessBrowser() {
  if (process.env.VERCEL) {
    const [{ default: chromium }, { default: puppeteer }] = await Promise.all([
      import("@sparticuz/chromium"),
      import("puppeteer-core"),
    ]);
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  const { default: puppeteer } = await import("puppeteer");
  // `next dev --experimental-https` serves renderOrigin with a self-signed
  // certificate. Only then — scripts pointed at a real --origin keep checking.
  return puppeteer.launch({
    headless: true,
    acceptInsecureCerts: process.env.__NEXT_EXPERIMENTAL_HTTPS === "1",
  });
}
