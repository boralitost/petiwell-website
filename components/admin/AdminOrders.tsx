"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminConfirm } from "@/components/admin/AdminConfirm";
import {
  isUsableTrackingNumber,
  nextActions,
  normalizeTrackingNumber,
  shouldRestoreStock,
  type OrderStatusName,
  type PaymentStatusName
} from "@/lib/order-status";

type OrderRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  status: string;
  paymentStatus: string;
  totalTry: { toString(): string } | number | string;
  refundedTry?: { toString(): string } | number | string;
  productTotalAfterDiscountTry?: { toString(): string } | number | string;
  productRefundedTry?: { toString(): string } | number | string;
  discountTry?: { toString(): string } | number | string;
  promoCode?: string | null;
  trackingNumber: string | null;
  paidEmailSentAt?: string | Date | null;
  createdAt: string | Date;
  items: { productName: string; quantity: number }[];
  payments?: {
    status: string;
    errorMessage: string | null;
    callbackAt: string | Date | null;
  }[];
  refunds?: {
    id: string;
    amountTry: { toString(): string } | number | string;
    productRefundTry: { toString(): string } | number | string;
    reason: string;
    status: string;
    createdAt: string | Date;
  }[];
};

type PendingConfirm = {
  orderId: string;
  title: string;
  body: string;
  confirmLabel: string;
  danger: boolean;
  patch: { status?: string; trackingNumber?: string; action?: string };
  okMessage: string;
};

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Ödeme bekleniyor",
  paid: "Ödendi",
  preparing: "Hazırlanıyor",
  shipped: "Kargoda",
  delivered: "Teslim edildi",
  cancelled: "İptal",
  refunded: "İade kaydı"
};

const ACTION_LABEL: Record<string, string> = {
  preparing: "Hazırlanıyor",
  shipped: "Kargoya ver",
  delivered: "Teslim edildi",
  cancelled: "İptal et",
  refunded: "İade kaydı"
};

function explainError(code: string): string {
  const map: Record<string, string> = {
    resend_test_mode_recipient:
      "Resend henüz sadece hesap e-postasına test maili gönderiyor. Resend → API Keys / Domain’de production sending açık mı bakın; spam klasörünü de kontrol edin.",
    resend_domain_unverified:
      "Gönderen domain Resend’de doğrulanmamış.",
    resend_from_not_allowed:
      "EMAIL_FROM adresi doğrulanmış domain ile eşleşmiyor.",
    resend_rejected: "Resend maili reddetti. Resend → Logs’a bakın.",
    email_failed: "Mail gönderilemedi.",
    email_not_configured: "RESEND_API_KEY eksik.",
    email_from_not_set:
      "Gönderen Gmail olamaz. Resend yalnızca doğrulanmış petiwell.com adresinden yollar (gelen kutusu gerekmez). Yanıtlar petiwelltr@gmail.com’a gider.",
    tracking_required:
      "Kargoya vermek için en az 5 karakterlik takip numarası yazın.",
    invalid_transition:
      "Bu faz geçişi izinli değil. İptal ve iade geri alınamaz.",
    payment_not_success: "Ödeme başarılı olmadan onay maili gönderilemez.",
    not_shipped: "Kargo maili yalnızca kargodaki siparişler için gönderilir.",
    tracking_only_when_shipped:
      "Takip numarası yalnızca kargodaki siparişte güncellenir.",
    paytr_refund_failed: "PayTR iade/iptal yapılamadı. Sipariş yerinde bırakıldı.",
    paytr_refund_not_json: "PayTR iade yanıtı okunamadı.",
    missing_oid: "Bu siparişte PayTR işlem numarası yok."
  };
  for (const [key, text] of Object.entries(map)) {
    if (code.includes(key)) return text;
  }
  return map[code] || code;
}

function confirmForStatus(
  order: OrderRow,
  next: OrderStatusName,
  tracking: string
): Omit<PendingConfirm, "orderId"> | { error: string } {
  const from = order.status as OrderStatusName;
  const paid = order.paymentStatus as PaymentStatusName;
  const restore = shouldRestoreStock(from, next, paid);

  if (next === "preparing") {
    return {
      title: "Siparişi hazırlamaya al",
      body: `${order.orderNumber} için müşteriye “siparişiniz hazırlanıyor” e-postası gidecek.`,
      confirmLabel: "Mail gönder ve kaydet",
      danger: false,
      patch: { status: "preparing" },
      okMessage: "Hazırlama maili gönderildi."
    };
  }

  if (next === "shipped") {
    if (!isUsableTrackingNumber(tracking)) {
      return { error: "tracking_required" };
    }
    return {
      title: "Kargoya ver",
      body: `${order.orderNumber} kargoya işaretlenecek.\nTakip no: ${normalizeTrackingNumber(tracking)}\n\nMüşteriye kargo e-postası gidecek. Kargo firması API’si yok; numarayı PTT / Yurtiçi / Aras vb. şubesinden aldığınız gibi yazın.`,
      confirmLabel: "Mail gönder ve kaydet",
      danger: false,
      patch: { status: "shipped", trackingNumber: normalizeTrackingNumber(tracking) },
      okMessage: "Kargo maili gönderildi."
    };
  }

  if (next === "delivered") {
    return {
      title: "Teslim edildi",
      body: `${order.orderNumber} teslim edildi olarak işaretlenecek. Müşteriye teslim e-postası gidecek. Stok değişmez.`,
      confirmLabel: "Mail gönder ve kaydet",
      danger: false,
      patch: { status: "delivered" },
      okMessage: "Teslim maili gönderildi."
    };
  }

  if (next === "cancelled") {
    if (from === "pending_payment") {
      return {
        title: "Ödenmemiş siparişi kapat",
        body: `${order.orderNumber} iptal edilecek. Ödeme alınmadığı için müşteriye mail gitmez ve stok değişmez. Bu işlem geri alınamaz.`,
        confirmLabel: "İptal et",
        danger: true,
        patch: { status: "cancelled" },
        okMessage: "Ödenmemiş sipariş kapatıldı."
      };
    }
    return {
      title: "Siparişi iptal et",
      body:
        `${order.orderNumber} iptal edilecek.\n` +
        `PayTR’de tutarın tamamı iade/iptal edilecek; paneldeki işlem de iade görünecek.\n` +
        `Müşteriye iptal e-postası gidecek.\n` +
        (restore
          ? "Ürün hâlâ depodaysa stok geri eklenir.\n"
          : "Kargoya verilmiş siparişte stok otomatik eklenmez.\n") +
        "PayTR iade olmazsa sipariş değişmez. Bu işlem geri alınamaz.",
      confirmLabel: "PayTR’de iade et ve iptal et",
      danger: true,
      patch: { status: "cancelled" },
      okMessage: "PayTR iade alındı, sipariş iptal edildi."
    };
  }

  if (next === "refunded") {
    return {
      title: "İade kaydı oluştur",
      body:
        `${order.orderNumber} iade kaydına alınacak.\n\n` +
        `PayTR’de tutarın tamamı iade edilecek.\n` +
        `Müşteriye iade e-postası gidecek.\n` +
        (restore
          ? "Stok geri eklenecek."
          : "Kargoya verilmiş / teslim edilmiş siparişte stok otomatik eklenmez. Ürün elinize geçince Stok ekranından ekleyin.") +
        "\nPayTR iade olmazsa sipariş değişmez. Bu işlem geri alınamaz.",
      confirmLabel: "PayTR’de iade et",
      danger: true,
      patch: { status: "refunded" },
      okMessage: "PayTR iade alındı, iade kaydı oluşturuldu."
    };
  }

  return { error: "invalid_transition" };
}

export function AdminOrders({
  orders,
  role = "OPERATIONS"
}: {
  orders: OrderRow[];
  role?: "SUPER_ADMIN" | "OPERATIONS" | "FINANCE";
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState("");
  const [syncOk, setSyncOk] = useState("");
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [trackingById, setTrackingById] = useState<Record<string, string>>({});

  function trackingValue(order: OrderRow): string {
    return trackingById[order.id] ?? order.trackingNumber ?? "";
  }

  async function updateOrder(
    id: string,
    patch: Record<string, unknown>,
    okMessage?: string
  ) {
    setBusyId(id);
    setSyncError("");
    setSyncOk("");
    const res = await fetch("/api/admin/orders", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch })
    });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    setPending(null);
    if (!res.ok || !data.ok) {
      setSyncError(explainError(String(data.error || "Güncellenemedi")));
      if (data.persisted) router.refresh();
      return;
    }
    setSyncOk(okMessage || "Kaydedildi.");
    router.refresh();
  }

  function askStatus(order: OrderRow, next: OrderStatusName) {
    const plan = confirmForStatus(order, next, trackingValue(order));
    if ("error" in plan) {
      setSyncError(explainError(plan.error));
      setSyncOk("");
      return;
    }
    setSyncError("");
    setPending({ orderId: order.id, ...plan });
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.refresh();
  }

  function partialRefund(order: OrderRow) {
    const remaining =
      Number(order.totalTry) - Number(order.refundedTry || 0);
    const productRemaining =
      Number(order.productTotalAfterDiscountTry || 0) -
      Number(order.productRefundedTry || 0);
    const amountRaw = window.prompt(
      `PayTR iade tutarı (kalan ${remaining.toFixed(2)} TL)`
    );
    if (!amountRaw) return;
    const productRaw = window.prompt(
      `Bu tutarın ürün bedeli kısmı (kalan ${productRemaining.toFixed(2)} TL)`
    );
    if (productRaw === null) return;
    const reason = window.prompt("Kısmi iade nedeni");
    if (!reason) return;
    void updateOrder(
      order.id,
      {
        action: "partial_refund",
        amountTry: Number(amountRaw.replace(",", ".")),
        productRefundTry: Number(productRaw.replace(",", ".")),
        reason,
        idempotencyKey: crypto.randomUUID()
      },
      "Kısmi PayTR iadesi ve komisyon düzeltmesi kaydedildi."
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Siparişler</h1>
        <button
          type="button"
          onClick={logout}
          className="text-sm text-neutral-600 hover:underline"
        >
          Çıkış
        </button>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600">
        Faz butonları onay ister; iptal ve iade geri alınamaz. Ödenmiş siparişi
        iptal edince PayTR’de de iade oluşur. Kargo API’si yok — takip numarasını
        yazmanız yeterli.
      </p>
      {syncError ? (
        <p className="mt-3 text-sm text-red-600">{syncError}</p>
      ) : null}
      {syncOk ? (
        <p className="mt-3 text-sm text-green-700">{syncOk}</p>
      ) : null}

      <div className="mt-8 space-y-4">
        {orders.length === 0 ? (
          <p className="text-sm text-neutral-600">Henüz sipariş yok.</p>
        ) : (
          orders.map((order) => {
            const lastPayment = order.payments?.[0];
            const actions = nextActions(order.status as OrderStatusName);
            const frozen =
              order.status === "cancelled" || order.status === "refunded";
            return (
              <article
                key={order.id}
                className="rounded-2xl border border-neutral-200 bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{order.orderNumber}</p>
                    <p className="text-sm text-neutral-600">
                      {order.customerName} · {order.customerEmail} ·{" "}
                      {order.customerPhone}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {order.items
                        .map((i) => `${i.productName} ×${i.quantity}`)
                        .join(", ")}
                    </p>
                    {lastPayment?.errorMessage ? (
                      <p className="mt-1 text-xs text-amber-700">
                        Ödeme notu: {explainError(
                          lastPayment.errorMessage.replace(/^email:/, "")
                        )}
                      </p>
                    ) : null}
                    {order.refunds?.map((refund) => (
                      <p
                        key={refund.id}
                        className={`mt-1 text-xs ${
                          refund.status === "failed"
                            ? "text-red-700"
                            : refund.status === "pending"
                              ? "text-amber-700"
                              : "text-green-700"
                        }`}
                      >
                        İade {String(refund.amountTry)} TL · {refund.status} ·{" "}
                        {refund.reason}
                      </p>
                    ))}
                    {order.paymentStatus !== "success" ? (
                      <p className="mt-1 text-xs text-amber-700">
                        PayTR bildirimi henüz işlenmedi. “PayTR doğrula”ya basın.
                        Olmazsa PayTR panel → İşlemler’den bildirimi tekrar gönderin.
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold">{String(order.totalTry)} TL</p>
                    {Number(order.refundedTry || 0) > 0 ? (
                      <p className="text-xs text-red-700">
                        İade: −{String(order.refundedTry)} TL
                      </p>
                    ) : null}
                    {order.promoCode ? (
                      <p className="text-xs text-neutral-500">
                        Kod {order.promoCode}
                        {order.discountTry
                          ? ` · −${String(order.discountTry)} TL`
                          : ""}
                      </p>
                    ) : null}
                    <p>
                      {STATUS_LABEL[order.status] || order.status} /{" "}
                      {order.paymentStatus === "success"
                        ? "ödeme OK"
                        : order.paymentStatus === "refunded"
                          ? "PayTR iade"
                          : order.paymentStatus}
                    </p>
                    {order.paidEmailSentAt ? (
                      <p className="mt-1 text-xs text-green-700">Onay maili gönderildi</p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {order.paymentStatus === "pending" ||
                  (order.paymentStatus === "failed" &&
                    order.status === "pending_payment") ? (
                    <button
                      type="button"
                      disabled={busyId === order.id}
                      onClick={() =>
                        updateOrder(order.id, { action: "sync_paytr" }, "PayTR doğrulandı.")
                      }
                      className="rounded-full border border-neutral-900 px-3 py-1 text-xs font-semibold hover:bg-neutral-50"
                    >
                      PayTR doğrula
                    </button>
                  ) : null}
                  {order.paymentStatus === "success" && !order.paidEmailSentAt ? (
                    <button
                      type="button"
                      disabled={busyId === order.id}
                      onClick={() =>
                        setPending({
                          orderId: order.id,
                          title: "Onay mailini gönder",
                          body: `${order.orderNumber} için müşteriye sipariş onay e-postası gidecek. Mail gittikten sonra bu buton kapanır.`,
                          confirmLabel: "Mail gönder",
                          danger: false,
                          patch: { action: "send_paid_email" },
                          okMessage: "Onay maili gönderildi."
                        })
                      }
                      className="rounded-full border border-amber-700 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-50"
                    >
                      Onay maili gönder
                    </button>
                  ) : null}
                  {order.paymentStatus === "success" &&
                  !frozen &&
                  ["SUPER_ADMIN", "FINANCE"].includes(role) &&
                  Number(order.refundedTry || 0) < Number(order.totalTry) ? (
                    <button
                      type="button"
                      disabled={busyId === order.id}
                      onClick={() => partialRefund(order)}
                      className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-800 hover:bg-red-50"
                    >
                      Kısmi İade
                    </button>
                  ) : null}
                  {actions
                    .filter((s) => s !== "shipped")
                    .map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={busyId === order.id}
                        onClick={() => askStatus(order, s)}
                        className={`rounded-full border px-3 py-1 text-xs hover:bg-neutral-50 ${
                          s === "cancelled" || s === "refunded"
                            ? "border-red-200 text-red-800"
                            : "border-neutral-200"
                        }`}
                      >
                        {ACTION_LABEL[s] || s}
                      </button>
                    ))}
                  {order.status === "shipped" ? (
                    <button
                      type="button"
                      disabled={busyId === order.id}
                      onClick={() =>
                        setPending({
                          orderId: order.id,
                          title: "Kargo mailini tekrar gönder",
                          body: `${order.orderNumber} için müşteriye mevcut takip numarasıyla kargo e-postası tekrar gidecek.`,
                          confirmLabel: "Mail gönder",
                          danger: false,
                          patch: { action: "send_shipped_email" },
                          okMessage: "Kargo maili tekrar gönderildi."
                        })
                      }
                      className="rounded-full border border-neutral-200 px-3 py-1 text-xs hover:bg-neutral-50"
                    >
                      Kargo mailini tekrar gönder
                    </button>
                  ) : null}
                </div>

                {actions.includes("shipped") || order.status === "shipped" ? (
                  <div className="mt-3 flex gap-2">
                    <input
                      value={trackingValue(order)}
                      placeholder="Kargo takip no (zorunlu)"
                      className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                      id={`track-${order.id}`}
                      onChange={(e) =>
                        setTrackingById((prev) => ({
                          ...prev,
                          [order.id]: e.target.value
                        }))
                      }
                    />
                    {actions.includes("shipped") ? (
                      <button
                        type="button"
                        className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white"
                        disabled={busyId === order.id}
                        onClick={() => askStatus(order, "shipped")}
                      >
                        Kargoya ver
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="rounded-full border border-neutral-900 px-4 py-2 text-xs font-semibold"
                        disabled={busyId === order.id}
                        onClick={() => {
                          const tracking = normalizeTrackingNumber(
                            trackingValue(order)
                          );
                          if (!isUsableTrackingNumber(tracking)) {
                            setSyncError(explainError("tracking_required"));
                            return;
                          }
                          setPending({
                            orderId: order.id,
                            title: "Takip numarasını güncelle",
                            body: `${order.orderNumber} takip no güncellenecek: ${tracking}\nMüşteriye kargo e-postası tekrar gidecek.`,
                            confirmLabel: "Güncelle ve mail gönder",
                            danger: false,
                            patch: { trackingNumber: tracking },
                            okMessage: "Takip no güncellendi, kargo maili gönderildi."
                          });
                        }}
                      >
                        Takip no güncelle
                      </button>
                    )}
                  </div>
                ) : order.trackingNumber ? (
                  <p className="mt-3 text-xs text-neutral-500">
                    Takip no: {order.trackingNumber}
                  </p>
                ) : null}

                {frozen ? (
                  <p className="mt-3 text-xs text-neutral-500">
                    Bu sipariş kilitli. Yanlışlıkla iptal/iade edildiyse stok
                    ekranından düzeltin; faz geri alınmaz.
                  </p>
                ) : null}
              </article>
            );
          })
        )}
      </div>

      {pending ? (
        <AdminConfirm
          title={pending.title}
          body={pending.body}
          confirmLabel={pending.confirmLabel}
          danger={pending.danger}
          busy={busyId === pending.orderId}
          onCancel={() => setPending(null)}
          onConfirm={() =>
            updateOrder(pending.orderId, pending.patch, pending.okMessage)
          }
        />
      ) : null}
    </div>
  );
}
