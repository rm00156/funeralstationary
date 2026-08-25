/**
 * Shared headless-Chromium launcher for server-side rendering jobs (proof
 * generation, template thumbnails) — anything that screenshots the real
 * PageCanvas via /proof-render.
 */

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
  return puppeteer.launch({ headless: true });
}
