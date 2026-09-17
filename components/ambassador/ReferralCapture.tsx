"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  CONSENT_STORAGE_KEY,
  readConsentChoice
} from "@/lib/consent";

export function ReferralCapture() {
  const searchParams = useSearchParams();
  const referralToken = searchParams.get("ref") || "";

  useEffect(() => {
    if (!referralToken) return;
    let sent = false;

    async function capture() {
      if (sent || readConsentChoice() !== "accepted") return;
      sent = true;
      const key = `petiwell_referral_captured_${referralToken}`;
      try {
        if (sessionStorage.getItem(key) === "1") return;
      } catch {
        /* continue without dedupe */
      }
      const response = await fetch("/api/ambassador/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referralToken,
          source: document.referrer ? "external_referrer" : "direct_link",
          consentAccepted: true
        })
      }).catch(() => null);
      if (response?.ok) {
        try {
          sessionStorage.setItem(key, "1");
        } catch {
          /* ignore */
        }
      } else {
        sent = false;
      }
    }

    void capture();
    const onConsent = () => void capture();
    const onStorage = (event: StorageEvent) => {
      if (event.key === CONSENT_STORAGE_KEY) void capture();
    };
    window.addEventListener("petiwell:consent", onConsent);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("petiwell:consent", onConsent);
      window.removeEventListener("storage", onStorage);
    };
  }, [referralToken]);

  return null;
}
