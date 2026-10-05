/**
 * Pricing model for Order of Service booklets.
 *
 * Pure and data-injected: the option arrays live in MySQL (loaded by
 * src/lib/pricing.server.ts and passed down as props), so this module holds
 * only the shapes and the arithmetic. All money is integer pence — the DB
 * stores pence and multipliers as decimal(6,4), so computing in pence avoids
 * float drift end-to-end.
 *
 * total = (quantity x unitPrice) + delivery
 * unitPrice = pageRate x paper x quantity-break
 */

export interface SelectOption {
  id: string;
  label: string;
  /** Multiplier applied to the per-copy price. */
  multiplier: number;
  note?: string;
}

export interface QuantityOption extends SelectOption {
  value: number;
}

export interface PageCountOption {
  id: string;
  label: string;
  pages: number;
  /** Base per-copy rate (A5, silk), in pence. */
  baseRatePence: number;
  note?: string;
}

export interface DeliveryOption {
  id: string;
  label: string;
  pricePence: number;
  note: string;
}

/** One product's full option set, as loaded from the DB. */
export interface PricingData {
  quantity: QuantityOption[];
  pages: PageCountOption[];
  paper: SelectOption[];
  delivery: DeliveryOption[];
}

export interface Selection {
  quantity: string;
  pages: string;
  paper: string;
  delivery: string;
}

export const SELECTION_AXES = ["quantity", "pages", "paper", "delivery"] as const;

/**
 * The design page's selection as query params, so it survives the hops
 * /products/[slug]/[template] → /design → basket. Axis names double as the
 * param names.
 */
export function selectionSearchParams(selection: Partial<Selection>): URLSearchParams {
  const params = new URLSearchParams();
  for (const axis of SELECTION_AXES) {
    const value = selection[axis];
    if (value) params.set(axis, value);
  }
  return params;
}

/**
 * Read a carried selection back out of the URL, keeping only slugs this
 * product actually offers. Anything else — a stale bookmark, a different
 * product's option — is dropped so the caller falls back to its default
 * rather than pricing a slug that doesn't exist.
 */
export function parseCarriedSelection(
  data: PricingData,
  params: Partial<Record<keyof Selection, string | string[] | undefined>>,
): Partial<Selection> {
  const carried: Partial<Selection> = {};
  for (const axis of SELECTION_AXES) {
    const value = params[axis];
    if (typeof value !== "string") continue;
    if ((data[axis] as { id: string }[]).some((option) => option.id === value)) {
      carried[axis] = value;
    }
  }
  return carried;
}

/** The first option on every axis — the DB rows are ordered by sort_order. */
export function defaultSelection(data: PricingData): Selection {
  return {
    quantity: data.quantity[0]?.id ?? "",
    pages: data.pages[0]?.id ?? "",
    paper: data.paper[0]?.id ?? "",
    delivery: data.delivery[0]?.id ?? "",
  };
}

export interface Quote {
  quantity: QuantityOption;
  pages: PageCountOption;
  paper: SelectOption;
  delivery: DeliveryOption;
  /** Price of a single booklet, in pence. */
  unitPricePence: number;
  /** quantity x unitPrice, in pence. */
  printCostPence: number;
  totalPence: number;
}

function find<T extends { id: string }>(options: T[], id: string): T {
  return options.find((option) => option.id === id) ?? options[0];
}

export function getQuote(data: PricingData, selection: Selection): Quote {
  const quantity = find(data.quantity, selection.quantity);
  const pages = find(data.pages, selection.pages);
  const paper = find(data.paper, selection.paper);
  const delivery = find(data.delivery, selection.delivery);

  const unitPricePence = Math.round(
    pages.baseRatePence *
      paper.multiplier *
      quantity.multiplier,
  );
  const printCostPence = unitPricePence * quantity.value;

  return {
    quantity,
    pages,
    paper,
    delivery,
    unitPricePence,
    printCostPence,
    totalPence: printCostPence + delivery.pricePence,
  };
}

function cheapest<T>(options: T[], cost: (option: T) => number): T | undefined {
  return options.reduce<T | undefined>(
    (best, option) => (best === undefined || cost(option) < cost(best) ? option : best),
    undefined,
  );
}

/**
 * The lowest total this product can be bought for — the "from £X" figure on
 * the product cards and product page. Cheapest option on every multiplier
 * axis, cheapest page rate and delivery, and whichever quantity gives the
 * lowest print cost (a bigger break lowers the unit price but multiplies it
 * by more copies, so that axis is searched rather than min'd). Null when any
 * axis has no options, since then nothing can be priced at all.
 */
export function cheapestQuote(data: PricingData): Quote | null {
  const paper = cheapest(data.paper, (option) => option.multiplier);
  const pages = cheapest(data.pages, (option) => option.baseRatePence);
  const delivery = cheapest(data.delivery, (option) => option.pricePence);
  if (!paper || !pages || !delivery || data.quantity.length === 0) {
    return null;
  }
  const base = { paper: paper.id, pages: pages.id, delivery: delivery.id };
  const quotes = data.quantity.map((quantity) => getQuote(data, { ...base, quantity: quantity.id }));
  return cheapest(quotes, (quote) => quote.totalPence) ?? null;
}

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

export const formatPence = (pence: number) => GBP.format(pence / 100);
