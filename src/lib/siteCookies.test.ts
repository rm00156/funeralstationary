import { describe, expect, it } from "vitest";

import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS } from "@/lib/adminSession";
import { GUEST_COOKIE, GUEST_COOKIE_SECONDS } from "@/lib/session";
import { SITE_COOKIES, cookieLifetimeText } from "@/lib/siteCookies";
import { USER_COOKIE, USER_SESSION_SECONDS } from "@/lib/userSession";

describe("SITE_COOKIES", () => {
  it("lists every cookie the site sets, with the lifetime it is set for", () => {
    expect(SITE_COOKIES.map(({ name, seconds }) => ({ name, seconds }))).toEqual([
      { name: GUEST_COOKIE, seconds: GUEST_COOKIE_SECONDS },
      { name: USER_COOKIE, seconds: USER_SESSION_SECONDS },
      { name: ADMIN_COOKIE, seconds: ADMIN_SESSION_SECONDS },
    ]);
  });

  it("explains each one", () => {
    for (const cookie of SITE_COOKIES) expect(cookie.purpose.length).toBeGreaterThan(20);
  });
});

describe("cookieLifetimeText", () => {
  it("names the largest unit that divides exactly", () => {
    expect(cookieLifetimeText(GUEST_COOKIE_SECONDS)).toBe("1 year");
    expect(cookieLifetimeText(USER_SESSION_SECONDS)).toBe("30 days");
    expect(cookieLifetimeText(ADMIN_SESSION_SECONDS)).toBe("12 hours");
    expect(cookieLifetimeText(60 * 60 * 24 * 365 * 2)).toBe("2 years");
    expect(cookieLifetimeText(60 * 15)).toBe("15 minutes");
  });

  it("falls back to a smaller unit rather than rounding", () => {
    expect(cookieLifetimeText(60 * 60 * 36)).toBe("36 hours");
    expect(cookieLifetimeText(90)).toBe("90 seconds");
  });
});
