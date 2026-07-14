type AnalyticsPayload = Record<string, string | number | boolean | undefined>;

/**
 * Lightweight analytics abstraction.
 * Wire a real provider (e.g. GA4) later — do not ship a fake measurement ID.
 */
export function trackEvent(eventName: string, payload: AnalyticsPayload = {}) {
  if (typeof window === "undefined") return;

  const detail = { eventName, ...payload, ts: Date.now() };

  window.dispatchEvent(new CustomEvent("petiwell:analytics", { detail }));

  // TODO: connect GA4 / Meta Pixel when a real measurement ID is available.
  if (process.env.NODE_ENV === "development") {
    // Quiet by default; uncomment when debugging events:
    // console.debug("[analytics]", detail);
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
