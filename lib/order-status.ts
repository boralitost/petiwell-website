export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded"
] as const;

export type OrderStatusName = (typeof ORDER_STATUSES)[number];

export type PaymentStatusName = "pending" | "success" | "failed" | "refunded";

export type CustomerEmailKind =
  | "preparing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

const ALLOWED: Record<OrderStatusName, OrderStatusName[]> = {
  pending_payment: ["cancelled"],
  paid: ["preparing", "shipped", "cancelled", "refunded"],
  preparing: ["shipped", "cancelled", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: []
};

export function isOrderStatus(value: string): value is OrderStatusName {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

export function canTransition(
  from: OrderStatusName,
  to: OrderStatusName
): boolean {
  if (from === to) return false;
  return ALLOWED[from]?.includes(to) ?? false;
}

export function normalizeTrackingNumber(raw: string | null | undefined): string {
  return (raw || "").trim().replace(/\s+/g, " ").slice(0, 64);
}

export function isUsableTrackingNumber(raw: string | null | undefined): boolean {
  const value = normalizeTrackingNumber(raw);
  return value.length >= 5;
}

export function requiresTrackingNumber(to: OrderStatusName): boolean {
  return to === "shipped";
}

/** Stock was taken on paid. Put it back only while goods are still in-house. */
export function shouldRestoreStock(
  from: OrderStatusName,
  to: OrderStatusName,
  paymentStatus: PaymentStatusName
): boolean {
  if (paymentStatus !== "success") return false;
  if (to !== "cancelled" && to !== "refunded") return false;
  return from === "paid" || from === "preparing";
}

export function customerEmailOnStatus(
  from: OrderStatusName,
  to: OrderStatusName,
  paymentStatus: PaymentStatusName
): CustomerEmailKind | null {
  if (!canTransition(from, to)) return null;
  if (from === "pending_payment" && to === "cancelled") return null;
  if (to === "refunded" && paymentStatus !== "success") return null;
  if (
    to === "preparing" ||
    to === "shipped" ||
    to === "delivered" ||
    to === "cancelled" ||
    to === "refunded"
  ) {
    return to;
  }
  return null;
}

export function nextActions(from: OrderStatusName): OrderStatusName[] {
  return ALLOWED[from] ?? [];
}

/** Paid cancel/refund must hit PayTR iade before local status changes. */
export function needsPaytrRefund(
  to: OrderStatusName,
  paymentStatus: PaymentStatusName
): boolean {
  if (paymentStatus !== "success") return false;
  return to === "cancelled" || to === "refunded";
}
