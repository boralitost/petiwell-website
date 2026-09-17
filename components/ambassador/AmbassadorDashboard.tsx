"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  ambassador: {
    publicId: string;
    firstName: string;
    status: string;
    couponCode: string;
    referralUrl: string;
    firstContentDueAt: string | null;
    terminationRequestedAt: string | null;
    terminationEffectiveAt: string | null;
  };
  commissions: {
    id: string;
    amount: number;
    status: string;
    createdAt: string;
    orderNumber: string;
    orderDate: string;
    orderStatus: string;
    productTotal: number;
  }[];
  payouts: {
    id: string;
    periodStart: string;
    periodEnd: string;
    netPayout: number;
    status: string;
    paidAt: string | null;
    disputes: {
      id: string;
      subject: string;
      createdAt: string;
      resolvedAt: string | null;
    }[];
  }[];
  contents: {
    id: string;
    platform: string;
    contentType: string;
    publishedUrl: string | null;
    status: string;
    reviewNotes: string | null;
    createdAt: string;
  }[];
  shipments: {
    id: string;
    status: string;
    carrier: string;
    trackingNumber: string;
    shippedAt: string | null;
  }[];
};

const cardClass = "rounded-2xl border border-line bg-surface p-5 shadow-soft";
const inputClass =
  "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm";

function tryMoney(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY"
  }).format(value);
}

export function AmbassadorDashboard({
  ambassador,
  commissions,
  payouts,
  contents,
  shipments
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const balances = useMemo(
    () => ({
      pending: commissions
        .filter((row) => row.status === "PENDING")
        .reduce((sum, row) => sum + row.amount, 0),
      approved: commissions
        .filter((row) => row.status === "APPROVED")
        .reduce((sum, row) => sum + row.amount, 0),
      paid: commissions
        .filter((row) => row.status === "PAID")
        .reduce((sum, row) => sum + row.amount, 0)
    }),
    [commissions]
  );

  async function request(payload: Record<string, unknown>) {
    const response = await fetch("/api/ambassador/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!data.ok) throw new Error(String(data.error || "İşlem tamamlanamadı."));
    router.refresh();
  }

  async function submitContent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy("content");
    setMessage("");
    const form = new FormData(e.currentTarget);
    try {
      await request({
        action: "submit_content",
        platform: form.get("platform"),
        contentType: form.get("contentType"),
        captionText: form.get("captionText"),
        publishedUrl: form.get("publishedUrl")
      });
      setMessage("İçerik incelemeye gönderildi.");
      e.currentTarget.reset();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "İşlem tamamlanamadı.");
    } finally {
      setBusy("");
    }
  }

  async function uploadPayoutInvoice(
    e: FormEvent<HTMLFormElement>,
    payoutId: string
  ) {
    e.preventDefault();
    setBusy(`invoice-${payoutId}`);
    setMessage("");
    const form = new FormData(e.currentTarget);
    form.set("payoutId", payoutId);
    try {
      const response = await fetch("/api/ambassador/portal/documents", {
        method: "POST",
        body: form
      });
      const data = await response.json().catch(() => ({}));
      if (!data.ok) throw new Error(String(data.error || "Belge yüklenemedi."));
      setMessage("Faturan güvenli yüklendi ve incelemeye alındı.");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Belge yüklenemedi.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="section-shell">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted">{ambassador.publicId}</p>
            <h1 className="text-3xl font-semibold">
              Merhaba {ambassador.firstName}
            </h1>
          </div>
          <span className="rounded-full bg-brand-soft px-4 py-2 text-xs font-semibold text-brand">
            {ambassador.status}
          </span>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["Bekleyen komisyon", balances.pending],
            ["Ödenebilir bakiye", balances.approved],
            ["Toplam ödenen", balances.paid]
          ].map(([label, value]) => (
            <div key={String(label)} className={cardClass}>
              <p className="text-xs text-muted">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-brand">
                {tryMoney(Number(value))}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className={`${cardClass} space-y-4`}>
            <h2 className="text-lg font-semibold">Kuponun ve bağlantın</h2>
            <div>
              <p className="text-xs text-muted">Müşteri indirim kodu</p>
              <div className="mt-1 flex gap-2">
                <code className="min-w-0 flex-1 rounded-xl bg-brand-soft p-3 font-semibold">
                  {ambassador.couponCode || "Hazırlanıyor"}
                </code>
                {ambassador.couponCode ? (
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(ambassador.couponCode)
                    }
                    className="rounded-xl border border-line px-4 text-sm"
                  >
                    Kopyala
                  </button>
                ) : null}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted">Referral bağlantısı</p>
              <div className="mt-1 flex gap-2">
                <code className="min-w-0 flex-1 break-all rounded-xl bg-brand-soft p-3 text-xs">
                  {ambassador.referralUrl || "Hazırlanıyor"}
                </code>
                {ambassador.referralUrl ? (
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(ambassador.referralUrl)
                    }
                    className="rounded-xl border border-line px-4 text-sm"
                  >
                    Kopyala
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className={`${cardClass} space-y-3`}>
            <h2 className="text-lg font-semibold">Başlangıç paketi</h2>
            {shipments.length === 0 ? (
              <p className="text-sm text-muted">Paket henüz hazırlanıyor.</p>
            ) : (
              shipments.map((shipment) => (
                <div key={shipment.id} className="rounded-xl bg-brand-soft p-3 text-sm">
                  <p className="font-semibold">{shipment.status}</p>
                  <p>
                    {shipment.carrier || "Kargo firması bekleniyor"}{" "}
                    {shipment.trackingNumber
                      ? `· ${shipment.trackingNumber}`
                      : ""}
                  </p>
                </div>
              ))
            )}
            {ambassador.firstContentDueAt ? (
              <p className="text-sm font-medium text-amber-800">
                İlk içerik son tarihi:{" "}
                {new Date(ambassador.firstContentDueAt).toLocaleDateString(
                  "tr-TR"
                )}
              </p>
            ) : null}
          </div>
        </div>

        <form onSubmit={submitContent} className={`${cardClass} space-y-3`}>
          <div>
            <h2 className="text-lg font-semibold">İçerik gönder</h2>
            <p className="text-xs text-muted">
              İlk içerik yayımdan önce gönderilmelidir. Taslak açıklaması veya
              yayımlanmış içerik URL’sinden en az birini ekle.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <select name="platform" required className={inputClass}>
              <option value="">Platform</option>
              <option>Instagram</option>
              <option>TikTok</option>
              <option>YouTube</option>
              <option>Diğer</option>
            </select>
            <select name="contentType" required className={inputClass}>
              <option value="">İçerik türü</option>
              <option>Reels / Video</option>
              <option>Gönderi</option>
              <option>Story</option>
              <option>Diğer</option>
            </select>
          </div>
          <textarea
            name="captionText"
            rows={4}
            placeholder="Taslak metin / açıklama"
            className={inputClass}
          />
          <input
            name="publishedUrl"
            type="url"
            placeholder="Yayımlanmış içerik URL’si (varsa)"
            className={inputClass}
          />
          <button
            disabled={busy === "content"}
            className="min-h-[46px] rounded-full bg-brand px-6 text-sm font-semibold text-white disabled:opacity-50"
          >
            İncelemeye Gönder
          </button>
        </form>

        {contents.length ? (
          <div className={cardClass}>
            <h2 className="text-lg font-semibold">İçeriklerin</h2>
            <div className="mt-3 space-y-2">
              {contents.map((content) => (
                <div key={content.id} className="rounded-xl border border-line p-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong>
                      {content.platform} · {content.contentType}
                    </strong>
                    <span>{content.status}</span>
                  </div>
                  {content.reviewNotes ? (
                    <p className="mt-2 text-amber-800">{content.reviewNotes}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className={cardClass}>
          <h2 className="text-lg font-semibold">Satış ve komisyon hareketleri</h2>
          <p className="mt-1 text-xs text-muted">
            Müşteri adı, e-posta, telefon veya adres bilgisi gösterilmez.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th className="py-2">Sipariş</th>
                  <th>Tarih</th>
                  <th>Ürün toplamı</th>
                  <th>Komisyon</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((commission) => (
                  <tr key={commission.id} className="border-b border-line/70">
                    <td className="py-3">{commission.orderNumber}</td>
                    <td>
                      {new Date(commission.orderDate).toLocaleDateString("tr-TR")}
                    </td>
                    <td>{tryMoney(commission.productTotal)}</td>
                    <td>{tryMoney(commission.amount)}</td>
                    <td>{commission.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={cardClass}>
          <h2 className="text-lg font-semibold">Ödemeler</h2>
          <div className="mt-3 space-y-3">
            {payouts.length === 0 ? (
              <p className="text-sm text-muted">Henüz ödeme dönemi oluşmadı.</p>
            ) : null}
            {payouts.map((payout) => (
              <div key={payout.id} className="rounded-xl border border-line p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span>
                    {new Date(payout.periodStart).toLocaleDateString("tr-TR")} –{" "}
                    {new Date(payout.periodEnd).toLocaleDateString("tr-TR")}
                  </span>
                  <strong>{tryMoney(payout.netPayout)} · {payout.status}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const subject = window.prompt("İtiraz konusu");
                    const description = window.prompt("Açıklama (en az 10 karakter)");
                    if (!subject || !description) return;
                    setBusy(`dispute-${payout.id}`);
                    void request({
                      action: "dispute_payout",
                      payoutId: payout.id,
                      subject,
                      description
                    })
                      .then(() => setMessage("İtiraz kaydedildi."))
                      .catch((err) =>
                        setMessage(
                          err instanceof Error ? err.message : "İşlem tamamlanamadı."
                        )
                      )
                      .finally(() => setBusy(""));
                  }}
                  disabled={busy === `dispute-${payout.id}`}
                  className="mt-2 text-xs font-semibold text-brand underline"
                >
                  Bu ödemeye itiraz et
                </button>
                {payout.status === "WAITING_DOCUMENT" ? (
                  <form
                    onSubmit={(event) =>
                      void uploadPayoutInvoice(event, payout.id)
                    }
                    className="mt-3 flex flex-wrap gap-2"
                  >
                    <input
                      name="file"
                      type="file"
                      required
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      className="min-w-0 flex-1 rounded-lg border border-line px-2 py-1 text-xs"
                    />
                    <button
                      disabled={busy === `invoice-${payout.id}`}
                      className="rounded-lg border border-brand px-3 py-1 text-xs font-semibold text-brand"
                    >
                      Faturayı yükle
                    </button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className={`${cardClass} border-red-200`}>
          <h2 className="font-semibold text-red-800">Programdan ayrılma</h2>
          {ambassador.terminationRequestedAt ? (
            <p className="mt-2 text-sm text-red-700">
              Ayrılma talebin alındı. Planlanan bitiş:{" "}
              {ambassador.terminationEffectiveAt
                ? new Date(ambassador.terminationEffectiveAt).toLocaleDateString(
                    "tr-TR"
                  )
                : "hesaplanıyor"}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (
                  !window.confirm(
                    "Programdan ayrılma talebini göndermek istiyor musun?"
                  )
                )
                  return;
                setBusy("termination");
                void request({ action: "request_termination" })
                  .then(() => setMessage("Ayrılma talebin alındı."))
                  .catch((err) =>
                    setMessage(
                      err instanceof Error ? err.message : "İşlem tamamlanamadı."
                    )
                  )
                  .finally(() => setBusy(""));
              }}
              disabled={busy === "termination"}
              className="mt-3 rounded-full border border-red-700 px-5 py-2 text-sm font-semibold text-red-800"
            >
              Ayrılma Talebi Gönder
            </button>
          )}
        </div>

        {message ? (
          <p className="rounded-xl bg-brand-soft p-3 text-sm text-brand">
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
