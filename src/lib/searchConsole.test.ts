import { describe, expect, it } from "vitest";
import {
  pagePath,
  parseSearchRows,
  searchAnalyticsBody,
  searchAnalyticsUrl,
  searchConsoleConfig,
  searchOpportunity,
  unsignedServiceAccountJwt,
} from "./searchConsole";

const KEY = "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n";

describe("searchConsoleConfig", () => {
  it("needs the site, the account and a key", () => {
    expect(searchConsoleConfig({})).toBeNull();
    expect(
      searchConsoleConfig({ GOOGLE_SEARCH_CONSOLE_SITE: "sc-domain:example.co.uk", GOOGLE_SERVICE_ACCOUNT_EMAIL: "a@b" }),
    ).toBeNull();
    expect(
      searchConsoleConfig({
        GOOGLE_SEARCH_CONSOLE_SITE: "sc-domain:example.co.uk",
        GOOGLE_SERVICE_ACCOUNT_EMAIL: "a@b",
        GOOGLE_SERVICE_ACCOUNT_KEY: "not a key",
      }),
    ).toBeNull();
  });

  it("turns a pasted key's \\n back into newlines", () => {
    const config = searchConsoleConfig({
      GOOGLE_SEARCH_CONSOLE_SITE: " sc-domain:example.co.uk ",
      GOOGLE_SERVICE_ACCOUNT_EMAIL: "reader@project.iam.gserviceaccount.com",
      GOOGLE_SERVICE_ACCOUNT_KEY: KEY,
    });
    expect(config).toEqual({
      siteUrl: "sc-domain:example.co.uk",
      clientEmail: "reader@project.iam.gserviceaccount.com",
      privateKey: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----",
    });
  });
});

describe("the request", () => {
  it("builds a read-only sign-in claim that lasts an hour", () => {
    const [header, claim] = unsignedServiceAccountJwt("reader@x", new Date("2026-10-14T10:00:00Z"))
      .split(".")
      .map((part) => JSON.parse(Buffer.from(part, "base64url").toString()));
    expect(header).toEqual({ alg: "RS256", typ: "JWT" });
    expect(claim).toMatchObject({
      iss: "reader@x",
      scope: "https://www.googleapis.com/auth/webmasters.readonly",
      aud: "https://oauth2.googleapis.com/token",
    });
    expect(claim.exp - claim.iat).toBe(3600);
  });

  it("escapes the property in the address", () => {
    expect(searchAnalyticsUrl("sc-domain:example.co.uk")).toBe(
      "https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain%3Aexample.co.uk/searchAnalytics/query",
    );
  });

  it("asks for one dimension, or a total", () => {
    expect(searchAnalyticsBody({ startDate: "2026-07-27", endDate: "2026-10-14" })).toEqual({
      startDate: "2026-07-27",
      endDate: "2026-10-14",
      rowLimit: 10,
      dataState: "final",
    });
    expect(searchAnalyticsBody({ startDate: "a", endDate: "b", dimension: "query", rowLimit: 5 })).toMatchObject({
      dimensions: ["query"],
      rowLimit: 5,
    });
  });
});

describe("the answer", () => {
  it("reads rows and shrugs off anything malformed", () => {
    expect(parseSearchRows(null)).toEqual([]);
    expect(parseSearchRows({})).toEqual([]);
    expect(
      parseSearchRows({
        rows: [
          { keys: ["order of service printing"], clicks: 12, impressions: 300, ctr: 0.04, position: 4.2 },
          { clicks: "x" },
        ],
      }),
    ).toEqual([
      { key: "order of service printing", clicks: 12, impressions: 300, position: 4.2 },
      { key: "", clicks: 0, impressions: 0, position: 0 },
    ]);
  });

  it("shows a page by its path", () => {
    expect(pagePath("https://www.example.co.uk/products/order-of-service")).toBe("/products/order-of-service");
    expect(pagePath("https://www.example.co.uk/")).toBe("/");
    expect(pagePath("not a url")).toBe("not a url");
  });

  it("picks the much-seen search that sits low on the page", () => {
    const row = (key: string, impressions: number, position: number) => ({ key, clicks: 1, impressions, position });
    expect(searchOpportunity([row("a", 500, 2), row("b", 40, 12)])).toBeNull();
    expect(searchOpportunity([row("a", 500, 2), row("b", 200, 9.6), row("c", 300, 11)])?.key).toBe("c");
  });
});
