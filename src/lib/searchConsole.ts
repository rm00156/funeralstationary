/**
 * Google Search Console, for the admin Analytics "Marketing & traffic" tab:
 * what people searched on Google before they clicked through to the site.
 * Pure and tested; searchConsole.server.ts signs in and asks.
 *
 * Search Console is read from Google's side — nothing is added to the site,
 * no script and no cookie — which is why it is the one traffic source the
 * site can show without a consent banner. Visitor counts, where visitors
 * came from and phone vs computer would need an analytics script (Google
 * Analytics sets cookies), so they are deliberately not here.
 */

export interface SearchConsoleConfig {
  /** The property as Search Console names it: "sc-domain:example.co.uk" or "https://www.example.co.uk/". */
  siteUrl: string;
  clientEmail: string;
  /** PEM, with real newlines. */
  privateKey: string;
}

/**
 * The connection from the environment, or null when any part is missing.
 * Vercel keeps a pasted key's newlines as "\n", so those are turned back.
 */
export function searchConsoleConfig(env: Record<string, string | undefined>): SearchConsoleConfig | null {
  const siteUrl = env.GOOGLE_SEARCH_CONSOLE_SITE?.trim();
  const clientEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n").trim();
  if (!siteUrl || !clientEmail || !privateKey?.includes("PRIVATE KEY")) return null;
  return { siteUrl, clientEmail, privateKey };
}

export const SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

const base64url = (value: string) => Buffer.from(value).toString("base64url");

/** The header and claim of a service account's sign-in JWT, ready to be signed (RS256). */
export function unsignedServiceAccountJwt(clientEmail: string, now: Date): string {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: clientEmail,
    scope: SEARCH_CONSOLE_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: issuedAt,
    exp: issuedAt + 3600,
  };
  return `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
}

export function searchAnalyticsUrl(siteUrl: string): string {
  return `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
}

export type SearchDimension = "query" | "page" | "device";

export function searchAnalyticsBody(input: {
  startDate: string;
  /** Inclusive, as Search Console counts it. */
  endDate: string;
  dimension?: SearchDimension;
  rowLimit?: number;
}) {
  return {
    startDate: input.startDate,
    endDate: input.endDate,
    ...(input.dimension ? { dimensions: [input.dimension] } : {}),
    rowLimit: input.rowLimit ?? 10,
    dataState: "final",
  };
}

export interface SearchRow {
  /** The query, page or device; "" for a total. */
  key: string;
  clicks: number;
  impressions: number;
  /** Average position in the results, 1 = top. */
  position: number;
}

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

/** Search Console's rows, defensively: anything malformed reads as nothing. */
export function parseSearchRows(json: unknown): SearchRow[] {
  const rows = (json as { rows?: unknown } | null)?.rows;
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const keys = (row as { keys?: unknown }).keys;
    return {
      key: Array.isArray(keys) && typeof keys[0] === "string" ? keys[0] : "",
      clicks: num((row as SearchRow).clicks),
      impressions: num((row as SearchRow).impressions),
      position: num((row as SearchRow).position),
    };
  });
}

export const DEVICE_LABELS: Record<string, string> = {
  MOBILE: "Phone",
  DESKTOP: "Computer",
  TABLET: "Tablet",
};

/** A page's address as the shop knows it: "/products/order-of-service", "/" for home. */
export function pagePath(url: string): string {
  try {
    const { pathname } = new URL(url);
    return pathname === "" ? "/" : pathname;
  } catch {
    return url;
  }
}

/**
 * A search that is seen often but rarely clicked because it sits low on
 * the page — the one worth a better page for. Null when none qualifies.
 */
export function searchOpportunity(rows: readonly SearchRow[]): SearchRow | null {
  return (
    [...rows]
      .filter((row) => row.position > 5 && row.impressions >= 50)
      .sort((a, b) => b.impressions - a.impressions)[0] ?? null
  );
}
