/**
 * Which page views reach Vercel Web Analytics. The root layout wraps every
 * page, including two that aren't customers browsing the shop:
 *
 * - `/proof-render` is loaded by headless Chromium for every proof, press PDF
 *   and template thumbnail — counting it would inflate traffic with the
 *   server's own renders.
 * - `/admin` is staff running the shop (and its sign-in URL can carry an
 *   email address).
 */
const UNTRACKED_PREFIXES = ["/proof-render", "/admin"];

/** True when a page view or event at this URL should be sent. */
export function shouldTrackUrl(url: string): boolean {
  let pathname: string;
  try {
    pathname = new URL(url, "http://localhost").pathname;
  } catch {
    return false;
  }
  return !UNTRACKED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
