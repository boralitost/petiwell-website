export const CONSENT_STORAGE_KEY = "petiwell_cookie_consent_v2";

export type ConsentChoice = "accepted" | "essential";

export const CONSENT_DENIED = {
  ad_storage: "denied",
  analytics_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied"
} as const;

export const CONSENT_GRANTED = {
  ad_storage: "granted",
  analytics_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted"
} as const;

export function isConsentChoice(raw: string | null): raw is ConsentChoice {
  return raw === "accepted" || raw === "essential";
}

export function readConsentChoice(): ConsentChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return isConsentChoice(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeConsentChoice(choice: ConsentChoice) {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
  } catch {
    /* ignore */
  }
}

export function consentDefaultScript(): string {
  return `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('consent', 'default', {
  ad_storage: 'denied',
  analytics_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  wait_for_update: 500
});
gtag('set', 'url_passthrough', true);
gtag('set', 'ads_data_redaction', true);
try {
  if (localStorage.getItem('${CONSENT_STORAGE_KEY}') === 'accepted') {
    gtag('consent', 'update', {
      ad_storage: 'granted',
      analytics_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted'
    });
  }
} catch (e) {}
`.trim();
}

export function applyConsent(choice: ConsentChoice) {
  if (typeof window === "undefined") return;
  writeConsentChoice(choice);
  document.cookie = `petiwell_consent=${choice}; Max-Age=31536000; Path=/; SameSite=Lax${
    window.location.protocol === "https:" ? "; Secure" : ""
  }`;
  if (choice === "essential") {
    void fetch("/api/ambassador/referral", { method: "DELETE" }).catch(
      () => undefined
    );
  }
  const gtag = window.gtag;
  if (typeof gtag === "function") {
    gtag(
      "consent",
      "update",
      choice === "accepted" ? CONSENT_GRANTED : CONSENT_DENIED
    );
  }
  window.dispatchEvent(
    new CustomEvent("petiwell:consent", { detail: { choice } })
  );
}
