"use client";

import { useEffect, useState } from "react";
import { trackPurchase } from "@/lib/analytics";

type Props = {
  locale: string;
  orderNumber: string;
};

export function CheckoutSuccessStatus({ locale, orderNumber }: Props) {
  const [status, setStatus] = useState<"checking" | "paid" | "pending" | "failed">(
    "checking"
  );

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;

    async function poll() {
      attempts += 1;
      try {
        const res = await fetch("/api/checkout/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oid: orderNumber })
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (data.status === "paid") {
          setStatus("paid");
          trackPurchase({
            transaction_id: String(data.transaction_id || orderNumber),
            value: Number(data.value || 0),
            currency: String(data.currency || "TRY"),
            items: Array.isArray(data.items) ? data.items : []
          });
          return;
        }
        if (data.status === "failed") {
          setStatus("failed");
          return;
        }
      } catch {
        /* keep polling */
      }
      if (cancelled) return;
      if (attempts >= 8) {
        setStatus("pending");
        return;
      }
      timer = window.setTimeout(poll, 2500);
    }

    poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [orderNumber]);

  if (status === "paid") {
    return (
      <p className="mt-3 text-sm text-green-800">
        {locale === "en"
          ? "Payment confirmed. A confirmation email is on the way — check spam too."
          : "Ödeme onaylandı. Onay e-postası yolda — spam klasörünü de kontrol edin."}
      </p>
    );
  }

  if (status === "failed") {
    return (
      <p className="mt-3 text-sm text-red-700">
        {locale === "en"
          ? "Payment was not completed."
          : "Ödeme tamamlanamadı."}
      </p>
    );
  }

  if (status === "pending") {
    return (
      <p className="mt-3 text-sm text-amber-800">
        {locale === "en"
          ? "PayTR is still confirming this payment. If it stays pending, open admin and tap PayTR doğrula."
          : "PayTR ödemeyi hâlâ doğruluyor. Beklemede kalırsa admin’den “PayTR doğrula”ya basın."}
      </p>
    );
  }

  return (
    <p className="mt-3 text-sm text-muted">
      {locale === "en"
        ? "Confirming payment with PayTR…"
        : "Ödeme PayTR ile doğrulanıyor…"}
    </p>
  );
}
