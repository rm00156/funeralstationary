import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/orders";

/** Surface-toned pills — same vocabulary as the admin template status pills. */
export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  draft: "bg-surface-container text-on-surface-variant",
  awaiting_proof: "bg-surface-container-high text-on-surface",
  proof_sent: "bg-primary-fixed text-on-primary-container",
  approved: "bg-soft-sage text-secondary",
  in_production: "bg-soft-sage text-secondary",
  shipped: "bg-secondary-container text-on-secondary-container",
  delivered: "bg-secondary-container text-on-secondary-container",
  cancelled: "bg-surface-container-high text-outline",
  refunded: "bg-surface-container-high text-outline",
};

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 font-body text-xs font-medium ${ORDER_STATUS_STYLES[status]}`}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
