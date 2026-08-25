/**
 * Pounds-string <-> integer-pence conversion for admin money inputs.
 *
 * All storage and arithmetic is integer pence (see orderOfServicePricing.ts);
 * admins type pounds. Parsing is strict — free-typed input either converts
 * exactly or is rejected, never rounded silently.
 */

/** "32.99" -> 3299. Null for empty, negative, malformed or >2dp input. */
export function poundsToPence(input: string): number | null {
  const trimmed = input.trim().replace(/^£/, "");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [pounds, pence = ""] = trimmed.split(".");
  return Number(pounds) * 100 + Number(pence.padEnd(2, "0"));
}

/** 3299 -> "32.99" — the value an admin money input should be prefilled with. */
export function penceToPoundsInput(pence: number): string {
  return (pence / 100).toFixed(2);
}
