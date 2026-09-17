export function isGtmId(raw: string): boolean {
  return /^GTM-[A-Z0-9]+$/i.test(raw.trim());
}

export function isGa4Id(raw: string): boolean {
  return /^G-[A-Z0-9]+$/i.test(raw.trim());
}

export function isGoogleAdsId(raw: string): boolean {
  return /^AW-[0-9]+$/i.test(raw.trim());
}

export function isAdsLabel(raw: string): boolean {
  return /^[A-Za-z0-9_-]{4,80}$/.test(raw.trim());
}

export function publicTrackingIds() {
  const gtm = (process.env.NEXT_PUBLIC_GTM_ID || "").trim();
  const ga4 = (process.env.NEXT_PUBLIC_GA4_ID || "").trim();
  const ads = (process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || "").trim();
  const purchaseLabel = (process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL || "").trim();
  return {
    gtm: isGtmId(gtm) ? gtm : "",
    ga4: isGa4Id(ga4) ? ga4 : "",
    ads: isGoogleAdsId(ads) ? ads : "",
    purchaseLabel: isAdsLabel(purchaseLabel) ? purchaseLabel : ""
  };
}

export function adsPurchaseSendTo(): string {
  const { ads, purchaseLabel } = publicTrackingIds();
  if (!ads || !purchaseLabel) return "";
  return `${ads}/${purchaseLabel}`;
}
