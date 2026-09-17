import { adsPurchaseSendTo } from "@/lib/tracking-ids";

type AnalyticsValue = string | number | boolean | undefined | null;
type AnalyticsPayload = Record<string, AnalyticsValue | AnalyticsItem[] | undefined>;

export type AnalyticsItem = {
  item_id: string;
  item_name: string;
  price?: number;
  quantity?: number;
};

export type PurchasePayload = {
  transaction_id: string;
  value: number;
  currency?: string;
  items?: AnalyticsItem[];
  email?: string;
};

const CHECKOUT_EMAIL_KEY = "petiwell_checkout_email";
const purchaseSent = new Set<string>();

function pushDataLayer(entry: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(entry);
}

function gtagCall(...args: unknown[]) {
  if (typeof window === "undefined") return;
  if (typeof window.gtag === "function") {
    window.gtag(...args);
    return;
  }
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(args);
}

export function trackEvent(eventName: string, payload: AnalyticsPayload = {}) {
  if (typeof window === "undefined") return;
  const detail = { eventName, ...payload, ts: Date.now() };
  window.dispatchEvent(new CustomEvent("petiwell:analytics", { detail }));
  pushDataLayer({ event: eventName, ...payload });
  gtagCall("event", eventName, payload);
}

export function rememberCheckoutEmail(email: string) {
  if (typeof window === "undefined") return;
  const value = email.trim().toLowerCase();
  if (!value || !value.includes("@")) return;
  try {
    window.sessionStorage.setItem(CHECKOUT_EMAIL_KEY, value);
  } catch {
    /* ignore */
  }
}

export function readCheckoutEmail(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(CHECKOUT_EMAIL_KEY) || "";
  } catch {
    return "";
  }
}

export function trackAddToCart(item: AnalyticsItem) {
  trackEvent("add_to_cart", {
    currency: "TRY",
    value: Number(item.price || 0) * Number(item.quantity || 1),
    items: [item]
  });
}

export function trackBeginCheckout(input: {
  value: number;
  items: AnalyticsItem[];
}) {
  trackEvent("begin_checkout", {
    currency: "TRY",
    value: input.value,
    items: input.items
  });
}

function purchaseKey(transactionId: string): string {
  return `petiwell_purchase_${transactionId}`;
}

export function wasPurchaseTracked(transactionId: string): boolean {
  if (!transactionId) return true;
  if (purchaseSent.has(transactionId)) return true;
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(purchaseKey(transactionId)) === "1";
  } catch {
    return false;
  }
}

function markPurchaseTracked(transactionId: string) {
  purchaseSent.add(transactionId);
  try {
    window.sessionStorage.setItem(purchaseKey(transactionId), "1");
  } catch {
    /* ignore */
  }
}

export function trackPurchase(input: PurchasePayload) {
  const transaction_id = String(input.transaction_id || "").trim();
  const value = Number(input.value);
  if (!transaction_id || !Number.isFinite(value) || value < 0) return;
  if (wasPurchaseTracked(transaction_id)) return;
  markPurchaseTracked(transaction_id);

  const currency = input.currency || "TRY";
  const items = input.items || [];
  const email = (input.email || readCheckoutEmail()).trim().toLowerCase();
  if (email.includes("@")) {
    gtagCall("set", "user_data", { email });
  }

  const params = {
    transaction_id,
    value,
    currency,
    items
  };
  trackEvent("purchase", params);

  const sendTo = adsPurchaseSendTo();
  if (sendTo) {
    gtagCall("event", "conversion", {
      send_to: sendTo,
      value,
      currency,
      transaction_id
    });
  }
}

export const AnalyticsEvents = {
  viewProductSection: "view_product_section",
  selectProduct: "select_product",
  interactProductGallery: "interact_product_gallery",
  viewIngredientDetail: "view_ingredient_detail",
  viewHowToUse: "view_how_to_use",
  openCampaignDetails: "open_campaign_details",
  openFaq: "open_faq",
  clickTrendyol: "click_trendyol",
  selectDecisionAid: "select_decision_aid"
} as const;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}
