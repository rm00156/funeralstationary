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
 * unitPrice = pageRate x size x colour x paper x quantity-break
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
  /** Base per-copy rate (A5, silk, full-colour both sides), in pence. */
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
  size: SelectOption[];
  colour: SelectOption[];
  pages: PageCountOption[];
  paper: SelectOption[];
  delivery: DeliveryOption[];
}

export interface Selection {
  quantity: string;
  size: string;
  colour: string;
  pages: string;
  paper: string;
  delivery: string;
}

/** The first option on every axis — the DB rows are ordered by sort_order. */
export function defaultSelection(data: PricingData): Selection {
  return {
    quantity: data.quantity[0]?.id ?? "",
    size: data.size[0]?.id ?? "",
    colour: data.colour[0]?.id ?? "",
    pages: data.pages[0]?.id ?? "",
    paper: data.paper[0]?.id ?? "",
    delivery: data.delivery[0]?.id ?? "",
  };
}

export interface Quote {
  quantity: QuantityOption;
  size: SelectOption;
  colour: SelectOption;
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
  const size = find(data.size, selection.size);
  const colour = find(data.colour, selection.colour);
  const pages = find(data.pages, selection.pages);
  const paper = find(data.paper, selection.paper);
  const delivery = find(data.delivery, selection.delivery);

  const unitPricePence = Math.round(
    pages.baseRatePence *
      size.multiplier *
      colour.multiplier *
      paper.multiplier *
      quantity.multiplier,
  );
  const printCostPence = unitPricePence * quantity.value;

  return {
    quantity,
    size,
    colour,
    pages,
    paper,
    delivery,
    unitPricePence,
    printCostPence,
    totalPence: printCostPence + delivery.pricePence,
  };
}

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

export const formatPence = (pence: number) => GBP.format(pence / 100);
