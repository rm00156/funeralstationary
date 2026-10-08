import { afterEach, describe, expect, it, vi } from "vitest";

import { siteOrigin, type OriginInput } from "@/lib/siteOrigin";

const spoofed: OriginInput = {
  requestUrl: "http://localhost:3001/api/admin/login",
  forwardedHost: "evil.example",
  forwardedProto: "https",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("siteOrigin", () => {
  it("builds links on SITE_URL whatever host the request claims", () => {
    expect(siteOrigin({ ...spoofed, siteUrl: "https://shop.example/some/path" })).toBe("https://shop.example");
  });

  it("prefers SITE_URL to Vercel's production domain", () => {
    expect(
      siteOrigin({
        ...spoofed,
        siteUrl: "https://shop.example",
        vercelEnv: "production",
        vercelProductionHost: "funeralstationary.vercel.app",
      }),
    ).toBe("https://shop.example");
  });

  it("uses Vercel's production domain on a production deploy with nothing configured", () => {
    expect(
      siteOrigin({ ...spoofed, vercelEnv: "production", vercelProductionHost: "funeralstationary.vercel.app" }),
    ).toBe("https://funeralstationary.vercel.app");
  });

  it("follows the request on a preview deploy, so preview links stay on the preview", () => {
    expect(
      siteOrigin({
        requestUrl: "https://x.vercel.app/api/checkout",
        forwardedHost: "feat-branch-x.vercel.app",
        forwardedProto: "https",
        vercelEnv: "preview",
        vercelProductionHost: "funeralstationary.vercel.app",
      }),
    ).toBe("https://feat-branch-x.vercel.app");
  });

  it("follows a dev tunnel's forwarded host and scheme when nothing is configured", () => {
    expect(
      siteOrigin({ requestUrl: "http://localhost:3001/x", forwardedHost: "abc.ngrok.app", forwardedProto: "https, http" }),
    ).toBe("https://abc.ngrok.app");
    expect(siteOrigin({ requestUrl: "http://localhost:3001/x", forwardedHost: "abc.ngrok.app", forwardedProto: null })).toBe(
      "https://abc.ngrok.app",
    );
  });

  it("falls back to the request URL without forwarded headers", () => {
    expect(siteOrigin({ requestUrl: "http://localhost:3001/x", forwardedHost: null, forwardedProto: null })).toBe(
      "http://localhost:3001",
    );
  });

  it("ignores a malformed SITE_URL loudly rather than breaking every link", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(siteOrigin({ ...spoofed, siteUrl: "shop.example" })).toBe("https://evil.example");
    expect(siteOrigin({ ...spoofed, siteUrl: "javascript:alert(1)" })).toBe("https://evil.example");
    expect(error).toHaveBeenCalledTimes(2);
  });

  it("treats a blank SITE_URL as unset", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(siteOrigin({ ...spoofed, siteUrl: "  " })).toBe("https://evil.example");
    expect(error).not.toHaveBeenCalled();
  });
});
