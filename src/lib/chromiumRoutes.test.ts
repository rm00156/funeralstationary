// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHROMIUM_ROUTES,
  chromiumTracingIncludes,
  routeGlob,
} from "@/lib/chromiumRoutes";

const SRC = path.resolve(import.meta.dirname, "..");
const LAUNCHER = path.join(SRC, "lib", "headlessBrowser.server.ts");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function resolveImport(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = path.join(SRC, specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.resolve(path.dirname(from), specifier);
  else return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Static and dynamic imports alike — the launcher itself is imported lazily. */
function importsOf(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const specifiers = [...source.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)];
  return specifiers
    .map((match) => resolveImport(file, match[1]))
    .filter((resolved): resolved is string => resolved !== null);
}

function reachesLauncher(file: string, seen = new Set<string>()): boolean {
  if (file === LAUNCHER) return true;
  if (seen.has(file)) return false;
  seen.add(file);
  return importsOf(file).some((next) => reachesLauncher(next, seen));
}

/** src/app/(group)/a/[id]/route.ts → /a/[id] */
function routePath(file: string): string {
  const segments = path
    .relative(path.join(SRC, "app"), path.dirname(file))
    .split(path.sep)
    .filter((segment) => segment && !/^\(.*\)$/.test(segment));
  return `/${segments.join("/")}`;
}

describe("CHROMIUM_ROUTES", () => {
  it("lists exactly the routes that can launch headless Chromium", () => {
    const entries = walk(path.join(SRC, "app")).filter((file) =>
      /\/(route|page)\.tsx?$/.test(file),
    );
    const launching = entries.filter((file) => reachesLauncher(file)).map(routePath);
    expect(launching.sort()).toEqual([...CHROMIUM_ROUTES].sort());
  });

  it("escapes dynamic segments so picomatch matches them literally", () => {
    expect(routeGlob("/api/admin/templates/[slug]/layout")).toBe(
      "/api/admin/templates/\\[slug\\]/layout",
    );
    expect(chromiumTracingIncludes()["/api/proof"]).toEqual([
      "./node_modules/@sparticuz/chromium/bin/**",
    ]);
  });
});
