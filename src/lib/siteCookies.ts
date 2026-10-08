/**
 * Every cookie this site sets, as the privacy page lists them. Names and
 * lifetimes come from the modules that set them, so the policy can't drift
 * from the code; a new cookie belongs here too (siteCookies.test.ts checks
 * the list against them).
 *
 * All of them are strictly necessary — they hold a basket or a sign-in the
 * visitor asked for — which is why the site asks for no cookie consent.
 * Adding an optional one (an ad pixel, cookie-based analytics, a Trustpilot
 * badge with `data-group`, which joins a split test) would change that: it
 * needs consent before it is set. The home page's Trustpilot badge sets none
 * (TrustpilotBadge.tsx).
 */
import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS } from "@/lib/adminSession";
import { GUEST_COOKIE, GUEST_COOKIE_SECONDS } from "@/lib/session";
import { USER_COOKIE, USER_SESSION_SECONDS } from "@/lib/userSession";

export type SiteCookie = {
  name: string;
  purpose: string;
  /** How long the browser keeps it, in seconds. */
  seconds: number;
};

export const SITE_COOKIES: readonly SiteCookie[] = [
  {
    name: GUEST_COOKIE,
    purpose:
      "Remembers your designs, uploads and basket on this device, so nothing is lost if you close the page. It's set the first time you save a design, add a photo, upload a file or add something to your basket.",
    seconds: GUEST_COOKIE_SECONDS,
  },
  {
    name: USER_COOKIE,
    purpose: "Keeps you signed in to your account after you use the link we email you.",
    seconds: USER_SESSION_SECONDS,
  },
  {
    name: ADMIN_COOKIE,
    purpose: "Keeps our own staff signed in to the shop's admin pages. Customers never get it.",
    seconds: ADMIN_SESSION_SECONDS,
  },
];

const UNITS = [
  { seconds: 60 * 60 * 24 * 365, singular: "year" },
  { seconds: 60 * 60 * 24, singular: "day" },
  { seconds: 60 * 60, singular: "hour" },
  { seconds: 60, singular: "minute" },
] as const;

/** "1 year", "30 days", "12 hours" — the largest unit that divides exactly. */
export function cookieLifetimeText(seconds: number): string {
  const unit = UNITS.find((u) => seconds >= u.seconds && seconds % u.seconds === 0);
  if (!unit) return `${seconds} seconds`;
  const count = seconds / unit.seconds;
  return `${count} ${unit.singular}${count === 1 ? "" : "s"}`;
}
