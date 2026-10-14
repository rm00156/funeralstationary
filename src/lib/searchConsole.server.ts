/**
 * Asks Google Search Console for the site's search figures, signed in as a
 * service account (a JWT signed here with node:crypto, exchanged for an
 * access token) — no Google package. The rules are in searchConsole.ts.
 *
 * Nothing is stored: the admin page asks each time it is opened.
 */
import { createSign } from "node:crypto";
import {
  GOOGLE_TOKEN_URL,
  parseSearchRows,
  searchAnalyticsBody,
  searchAnalyticsUrl,
  searchConsoleConfig,
  unsignedServiceAccountJwt,
  type SearchConsoleConfig,
  type SearchRow,
} from "@/lib/searchConsole";

export const getSearchConsoleConfig = () => searchConsoleConfig(process.env);

async function accessToken(config: SearchConsoleConfig): Promise<string> {
  const unsigned = unsignedServiceAccountJwt(config.clientEmail, new Date());
  const signature = createSign("RSA-SHA256").update(unsigned).sign(config.privateKey).toString("base64url");
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
    cache: "no-store",
  });
  const json = (await response.json().catch(() => null)) as { access_token?: string; error?: string } | null;
  if (!response.ok || !json?.access_token) throw new Error(`Google sign-in failed: ${json?.error ?? response.status}`);
  return json.access_token;
}

export interface SearchReport {
  total: SearchRow | null;
  previousTotal: SearchRow | null;
  queries: SearchRow[];
  pages: SearchRow[];
  devices: SearchRow[];
}

export type SearchReportResult =
  | { kind: "not-configured" }
  | { kind: "failed"; message: string }
  | { kind: "ok"; report: SearchReport };

/**
 * The period's searches. Dates are inclusive, as Search Console counts
 * them; its last two or three days are always still filling in.
 */
export async function loadSearchReport(input: {
  startDate: string;
  endDate: string;
  previousStartDate: string;
  previousEndDate: string;
}): Promise<SearchReportResult> {
  const config = getSearchConsoleConfig();
  if (!config) return { kind: "not-configured" };
  try {
    const token = await accessToken(config);
    const ask = async (body: ReturnType<typeof searchAnalyticsBody>) => {
      const response = await fetch(searchAnalyticsUrl(config.siteUrl), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        const message = (json as { error?: { message?: string } } | null)?.error?.message;
        throw new Error(message ?? `Search Console answered ${response.status}`);
      }
      return parseSearchRows(json);
    };
    const range = { startDate: input.startDate, endDate: input.endDate };
    const [total, previousTotal, queries, pages, devices] = await Promise.all([
      ask(searchAnalyticsBody(range)),
      ask(searchAnalyticsBody({ startDate: input.previousStartDate, endDate: input.previousEndDate })),
      ask(searchAnalyticsBody({ ...range, dimension: "query", rowLimit: 10 })),
      ask(searchAnalyticsBody({ ...range, dimension: "page", rowLimit: 8 })),
      ask(searchAnalyticsBody({ ...range, dimension: "device" })),
    ]);
    return {
      kind: "ok",
      report: { total: total[0] ?? null, previousTotal: previousTotal[0] ?? null, queries, pages, devices },
    };
  } catch (error) {
    console.error("[analytics] Search Console", error);
    return { kind: "failed", message: error instanceof Error ? error.message : "Search Console didn’t answer" };
  }
}
