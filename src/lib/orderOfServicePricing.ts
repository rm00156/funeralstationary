/**
 * Pricing model for Order of Service booklets.
 *
 * PLACEHOLDER RATES — these are calibrated so that the known real-world
 * quote (15 copies / A5 Layout 1 / full-colour both sides / 4 page / Silk
 * = £32.99) comes out exact, then extrapolated linearly. Swap the numbers
 * below for the real price list when it's available; nothing else needs
 * to change.
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
  /** Base per-copy rate (A5, silk, full-colour both sides). */
  rate: number;
  note?: string;
}

/** Quantity breaks — larger runs reduce the per-copy rate. */
export const QUANTITY_OPTIONS: QuantityOption[] = [
  { id: "15", label: "15", value: 15, multiplier: 1 },
  { id: "25", label: "25", value: 25, multiplier: 0.95 },
  { id: "50", label: "50", value: 50, multiplier: 0.9 },
  { id: "75", label: "75", value: 75, multiplier: 0.87 },
  { id: "100", label: "100", value: 100, multiplier: 0.84 },
  { id: "150", label: "150", value: 150, multiplier: 0.81 },
  { id: "200", label: "200", value: 200, multiplier: 0.78 },
  { id: "250", label: "250", value: 250, multiplier: 0.76 },
  { id: "300", label: "300", value: 300, multiplier: 0.74 },
];

export const SIZE_OPTIONS: SelectOption[] = [
  {
    id: "a5",
    label: "A5",
    multiplier: 1,
    note: "148 x 210mm portrait — our most popular booklet",
  },
];

export const COLOUR_OPTIONS: SelectOption[] = [
  {
    id: "full-colour-both",
    label: "Full-colour both sides",
    multiplier: 1,
    note: "Colour throughout, inside and out",
  },
  {
    id: "full-colour-cover",
    label: "Full-colour cover, mono inside",
    multiplier: 0.85,
    note: "Colour cover with black & white inner pages",
  },
  {
    id: "mono",
    label: "Black & white",
    multiplier: 0.7,
    note: "Traditional monochrome throughout",
  },
];

export const PAGE_OPTIONS: PageCountOption[] = [
  { id: "4", label: "4 page", pages: 4, rate: 2.2, note: "A single folded sheet" },
  { id: "8", label: "8 page", pages: 8, rate: 3.0 },
  { id: "12", label: "12 page", pages: 12, rate: 3.8 },
  { id: "16", label: "16 page", pages: 16, rate: 4.6 },
  { id: "20", label: "20 page", pages: 20, rate: 5.4 },
  { id: "24", label: "24 page", pages: 24, rate: 6.2, note: "Stapled on the spine" },
];

export const PAPER_OPTIONS: SelectOption[] = [
  {
    id: "silk",
    label: "Silk",
    multiplier: 1,
    note: "150gsm silk — a soft sheen that keeps photographs true",
  },
  {
    id: "gloss",
    label: "Gloss",
    multiplier: 1,
    note: "150gsm gloss — bright, high-contrast images",
  },
  {
    id: "uncoated",
    label: "Uncoated",
    multiplier: 1.05,
    note: "150gsm uncoated — natural, tactile finish, easy to write on",
  },
  {
    id: "premium-silk",
    label: "Premium Silk",
    multiplier: 1.2,
    note: "200gsm silk — our heaviest, most substantial stock",
  },
];

export interface DeliveryOption {
  id: string;
  label: string;
  price: number;
  note: string;
}

export const DELIVERY_OPTIONS: DeliveryOption[] = [
  {
    id: "standard",
    label: "Standard delivery",
    price: 0,
    note: "Free — 3 to 5 working days",
  },
  {
    id: "next-day",
    label: "Next day delivery",
    price: 10,
    note: "Order before 11am for next working day",
  },
];

export interface Selection {
  quantity: string;
  size: string;
  colour: string;
  pages: string;
  paper: string;
  delivery: string;
}

export const DEFAULT_SELECTION: Selection = {
  quantity: "15",
  size: "a5",
  colour: "full-colour-both",
  pages: "4",
  paper: "silk",
  delivery: "standard",
};

export interface Quote {
  quantity: QuantityOption;
  size: SelectOption;
  colour: SelectOption;
  pages: PageCountOption;
  paper: SelectOption;
  delivery: DeliveryOption;
  /** Price of a single booklet, rounded to the nearest penny. */
  unitPrice: number;
  /** quantity x unitPrice */
  printCost: number;
  total: number;
}

function find<T extends { id: string }>(options: T[], id: string): T {
  return options.find((option) => option.id === id) ?? options[0];
}

const roundPence = (value: number) => Math.round(value * 100) / 100;

export function getQuote(selection: Selection): Quote {
  const quantity = find(QUANTITY_OPTIONS, selection.quantity);
  const size = find(SIZE_OPTIONS, selection.size);
  const colour = find(COLOUR_OPTIONS, selection.colour);
  const pages = find(PAGE_OPTIONS, selection.pages);
  const paper = find(PAPER_OPTIONS, selection.paper);
  const delivery = find(DELIVERY_OPTIONS, selection.delivery);

  const unitPrice = roundPence(
    pages.rate *
      size.multiplier *
      colour.multiplier *
      paper.multiplier *
      quantity.multiplier,
  );
  const printCost = roundPence(unitPrice * quantity.value);

  return {
    quantity,
    size,
    colour,
    pages,
    paper,
    delivery,
    unitPrice,
    printCost,
    total: roundPence(printCost + delivery.price),
  };
}

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

export const formatPrice = (value: number) => GBP.format(value);
