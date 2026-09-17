/**
 * Commerce policy helpers. Product list prices live on Product (priceTry).
 * Totals for checkout MUST be recalculated on the server from these sources.
 */

export const CURRENCY = "TRY" as const;

export function isDirectSalesEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DIRECT_SALES_ENABLED === "true";
}

export function getShippingFlatTry(): number {
  const raw = process.env.SHIPPING_FLAT_TRY ?? "0";
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function getShippingFreeOverTry(): number {
  const raw = process.env.SHIPPING_FREE_OVER_TRY ?? "0";
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function calcShippingTry(subtotalTry: number): number {
  if (subtotalTry <= 0) return 0;
  if (subtotalTry >= getShippingFreeOverTry()) return 0;
  return getShippingFlatTry();
}

/** Format TRY for UI (tr-TR). */
export function formatTry(amount: number, locale: string = "tr-TR"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2
  }).format(amount);
}

export type CartLineInput = {
  productId: string;
  quantity: number;
};

export type PricedLine = {
  productId: string;
  sku: string;
  name: string;
  unitPriceTry: number;
  quantity: number;
  lineTotalTry: number;
  campaignDiscountTry?: number;
  ambassadorDiscountTry?: number;
  finalProductTotalTry?: number;
  vatRateSnapshot?: number;
  netProductTry?: number;
};

export type OrderTotals = {
  subtotalTry: number;
  shippingTry: number;
  discountTry: number;
  totalTry: number;
  promoCode?: string | null;
  campaignDiscountTry?: number;
  ambassadorDiscountTry?: number;
  productTotalAfterDiscountTry?: number;
  productNetExVatTry?: number;
  vatRateSnapshot?: number;
  ambassadorPublicId?: string | null;
  attributionType?: "MANUAL_COUPON" | "REFERRAL" | "NONE";
  customerDiscountRateSnapshot?: number;
  commissionRateSnapshot?: number;
};
