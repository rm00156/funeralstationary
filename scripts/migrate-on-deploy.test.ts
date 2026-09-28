import { describe, it, expect } from "vitest";
import { migrateDecision } from "./migrate-on-deploy";

describe("migrateDecision", () => {
  it("runs on a production deploy", () => {
    expect(migrateDecision({ VERCEL_ENV: "production" })).toEqual({ run: true });
  });

  it("refuses a preview deploy, whatever database it can see", () => {
    const d = migrateDecision({
      VERCEL_ENV: "preview",
      // A DATABASE_URL mis-scoped to Preview. Still refused.
      DATABASE_URL: "mysql://user:pw@prod-host/funeralstationary",
    });
    expect(d.run).toBe(false);
    expect(d).toHaveProperty("reason", expect.stringContaining("preview"));
  });

  it("refuses Vercel's development environment too", () => {
    expect(migrateDecision({ VERCEL_ENV: "development" }).run).toBe(false);
  });

  it("refuses outside Vercel, where a build shouldn't migrate as a side effect", () => {
    const d = migrateDecision({});
    expect(d.run).toBe(false);
    expect(d).toHaveProperty("reason", expect.stringContaining("db:migrate"));
  });

  it("allows a preview to migrate only with the explicit opt-in", () => {
    expect(migrateDecision({ VERCEL_ENV: "preview", ALLOW_PREVIEW_MIGRATIONS: "1" })).toEqual({
      run: true,
    });
  });

  it('ignores the opt-in unless it is exactly "1"', () => {
    expect(migrateDecision({ VERCEL_ENV: "preview", ALLOW_PREVIEW_MIGRATIONS: "true" }).run).toBe(
      false,
    );
  });
});
