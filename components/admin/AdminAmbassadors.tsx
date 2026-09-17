"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type AmbassadorRow = {
  id: string;
  publicId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: string;
  taxType: string | null;
  taxIdLast4: string | null;
  taxStatusValid: boolean;
  ibanLast4: string | null;
  ibanHolderName: string | null;
  primarySocialPlatform: string;
  instagramUsername: string;
  tiktokUsername: string;
  youtubeUsername: string;
  createdAt: string | Date;
  documents: {
    id: string;
    documentType: string;
    originalName: string;
    status: string;
    uploadedAt: string | Date;
  }[];
  coupons: { code: string; active: boolean }[];
  shipments: {
    id: string;
    status: string;
    carrier: string;
    trackingNumber: string;
  }[];
  contents: {
    id: string;
    platform: string;
    contentType: string;
    publishedUrl: string | null;
    captionText: string | null;
    status: string;
    isFirstContent: boolean;
  }[];
  payouts: {
    id: string;
    periodStart: string | Date;
    periodEnd: string | Date;
    netPayout: number | string;
    status: string;
  }[];
  fraudFlags: {
    id: string;
    type: string;
    severity: string;
    notes: string | null;
    status: string;
  }[];
};

type Props = {
  ambassadors: AmbassadorRow[];
  role: "SUPER_ADMIN" | "OPERATIONS" | "FINANCE" | "CONTENT_REVIEW";
};

const fieldClass =
  "rounded-lg border border-neutral-300 px-3 py-2 text-sm";

export function AdminAmbassadors({
  ambassadors,
  role
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const canOperate = role === "SUPER_ADMIN" || role === "OPERATIONS";
  const canFinance = role === "SUPER_ADMIN" || role === "FINANCE";
  const canReviewContent =
    role === "SUPER_ADMIN" || role === "CONTENT_REVIEW";
  const filteredAmbassadors = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr-TR");
    return ambassadors.filter((row) => {
      const statusOk = !statusFilter || row.status === statusFilter;
      const queryOk =
        !normalized ||
        [
          row.publicId,
          row.firstName,
          row.lastName,
          row.email,
          row.instagramUsername,
          row.tiktokUsername
        ]
          .join(" ")
          .toLocaleLowerCase("tr-TR")
          .includes(normalized);
      return statusOk && queryOk;
    });
  }, [ambassadors, query, statusFilter]);

  function downloadCsv() {
    const quote = (value: unknown) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["Elçi ID", "Ad Soyad", "E-posta", "Durum", "Kupon"],
      ...filteredAmbassadors.map((row) => [
        row.publicId,
        `${row.firstName} ${row.lastName}`,
        row.email,
        row.status,
        row.coupons[0]?.code || ""
      ])
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(quote).join(",")).join("\n")}`;
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `petiwell-elciler-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function call(payload: Record<string, unknown>) {
    const response = await fetch("/api/admin/ambassadors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!data.ok) throw new Error(String(data.error || "server_error"));
    router.refresh();
    return data;
  }

  async function invite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy("invite");
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const response = await fetch("/api/admin/ambassadors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          email: form.get("email"),
          socialHandle: form.get("socialHandle")
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!data.ok) throw new Error(String(data.error || "server_error"));
      setInviteUrl(String(data.onboardingUrl || ""));
      e.currentTarget.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "server_error");
    } finally {
      setBusy("");
    }
  }

  async function action(key: string, payload: Record<string, unknown>) {
    setBusy(key);
    setError("");
    try {
      await call(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "server_error");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="mt-8 space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Marka Elçileri</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Davet, belge/vergi incelemesi, başlangıç paketi ve aktivasyon.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-neutral-200 p-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Elçi ara: ad, e-posta, ID, sosyal hesap"
          className={`${fieldClass} min-w-[260px] flex-1`}
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className={fieldClass}
        >
          <option value="">Tüm durumlar</option>
          {[...new Set(ambassadors.map((row) => row.status))].map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={downloadCsv}
          className="rounded-lg border border-neutral-400 px-3 py-2 text-sm font-semibold"
        >
          CSV İndir
        </button>
      </div>

      {canOperate ? <form
        onSubmit={invite}
        className="grid gap-3 rounded-xl border border-neutral-200 p-4 sm:grid-cols-4"
      >
        <input name="firstName" placeholder="Ad" className={fieldClass} />
        <input name="lastName" placeholder="Soyad" className={fieldClass} />
        <input
          name="email"
          type="email"
          placeholder="E-posta (varsa)"
          className={fieldClass}
        />
        <input
          name="socialHandle"
          placeholder="@kullaniciadi"
          className={fieldClass}
        />
        <button
          disabled={busy === "invite"}
          className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 sm:col-span-4"
        >
          Yeni Elçi Daveti Oluştur
        </button>
        {inviteUrl ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-green-50 p-3 text-sm sm:col-span-4">
            <code className="min-w-0 flex-1 break-all">{inviteUrl}</code>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(inviteUrl)}
              className="rounded-lg border border-green-700 px-3 py-1 font-semibold text-green-800"
            >
              Kopyala
            </button>
          </div>
        ) : null}
      </form> : null}

      {error ? (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="space-y-4">
        {filteredAmbassadors.length === 0 ? (
          <p className="text-sm text-neutral-500">Henüz Elçi başvurusu yok.</p>
        ) : null}
        {filteredAmbassadors.map((ambassador) => {
          const shipment = ambassador.shipments[0];
          const actionable = ["REVIEW_PENDING", "MISSING_DOCUMENTS"].includes(
            ambassador.status
          );
          return (
            <article
              key={ambassador.id}
              className="rounded-xl border border-neutral-200 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">
                    {ambassador.firstName} {ambassador.lastName}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    {ambassador.publicId} · {ambassador.email} ·{" "}
                    {ambassador.phone}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {ambassador.primarySocialPlatform} · Instagram:{" "}
                    {ambassador.instagramUsername || "—"} · TikTok:{" "}
                    {ambassador.tiktokUsername || "—"}
                  </p>
                </div>
                <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-800">
                  {ambassador.status}
                </span>
              </div>

              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-lg bg-neutral-50 p-3">
                  <p className="text-xs text-neutral-500">Vergi</p>
                  <p>
                    {ambassador.taxType || "—"} · ••••{" "}
                    {ambassador.taxIdLast4 || "—"}
                  </p>
                  <p className={ambassador.taxStatusValid ? "text-green-700" : "text-amber-700"}>
                    {ambassador.taxStatusValid ? "Doğrulandı" : "İnceleme bekliyor"}
                  </p>
                </div>
                <div className="rounded-lg bg-neutral-50 p-3">
                  <p className="text-xs text-neutral-500">Banka</p>
                  <p>TR•••• {ambassador.ibanLast4 || "—"}</p>
                  <p>{ambassador.ibanHolderName || "—"}</p>
                </div>
                <div className="rounded-lg bg-neutral-50 p-3">
                  <p className="text-xs text-neutral-500">Kupon</p>
                  <p>{ambassador.coupons[0]?.code || "Onay sonrası oluşur"}</p>
                </div>
              </div>

              {ambassador.fraudFlags.length ? (
                <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3">
                  <p className="text-sm font-semibold text-red-800">
                    Açık risk bayrakları
                  </p>
                  {ambassador.fraudFlags.map((flag) => (
                    <div key={flag.id} className="mt-2 text-xs text-red-800">
                      <p>
                        {flag.severity} · {flag.type} ·{" "}
                        {flag.notes || "İnceleme gerekli"}
                      </p>
                      <div className="mt-1 flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void action(`fraud-dismiss-${flag.id}`, {
                              action: "review_fraud",
                              ambassadorId: ambassador.id,
                              flagId: flag.id,
                              status: "DISMISSED",
                              note: window.prompt("Yanlış alarm notu") || ""
                            })
                          }
                          className="rounded border border-neutral-500 px-2 py-1"
                        >
                          Yanlış Alarm
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void action(`fraud-resolve-${flag.id}`, {
                              action: "review_fraud",
                              ambassadorId: ambassador.id,
                              flagId: flag.id,
                              status: "RESOLVED",
                              note: window.prompt("İnceleme sonucu") || ""
                            })
                          }
                          className="rounded border border-red-700 px-2 py-1 font-semibold"
                        >
                          İhlal Olarak Kapat
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 space-y-2">
                <p className="text-sm font-semibold">Belgeler</p>
                {ambassador.documents.length === 0 ? (
                  <p className="text-xs text-amber-700">Belge yüklenmemiş.</p>
                ) : null}
                {ambassador.documents.map((document) => (
                  <div
                    key={document.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 p-2 text-xs"
                  >
                    <a
                      href={`/api/admin/ambassadors/documents/${document.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-purple-700 underline"
                    >
                      {document.documentType} — {document.originalName}
                    </a>
                    <span>{document.status}</span>
                    {document.status === "PENDING" &&
                    (canOperate || canFinance) ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            void action(`doc-${document.id}`, {
                              action: "review_document",
                              ambassadorId: ambassador.id,
                              documentId: document.id,
                              status: "APPROVED"
                            })
                          }
                          className="rounded border border-green-700 px-2 py-1 text-green-800"
                        >
                          Belgeyi onayla
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void action(`doc-${document.id}`, {
                              action: "review_document",
                              ambassadorId: ambassador.id,
                              documentId: document.id,
                              status: "REJECTED",
                              reason: window.prompt("Ret nedeni") || ""
                            })
                          }
                          className="rounded border border-red-700 px-2 py-1 text-red-800"
                        >
                          Reddet
                        </button>
                      </>
                    ) : null}
                  </div>
                ))}
              </div>

              {actionable && (canOperate || canFinance) ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {canFinance ? <button
                    type="button"
                    onClick={() =>
                      void action(`tax-${ambassador.id}`, {
                        action: "verify_tax",
                        ambassadorId: ambassador.id,
                        valid: !ambassador.taxStatusValid
                      })
                    }
                    className="rounded-lg border border-neutral-400 px-3 py-2 text-xs font-semibold"
                  >
                    {ambassador.taxStatusValid
                      ? "Vergi doğrulamasını kaldır"
                      : "Vergiyi doğrula"}
                  </button> : null}
                  {canOperate ? <button
                    type="button"
                    onClick={() =>
                      void action(`approve-${ambassador.id}`, {
                        action: "approve",
                        ambassadorId: ambassador.id,
                        couponCode:
                          window.prompt(
                            "Kupon kodu (boş bırakırsanız otomatik oluşturulur)"
                          ) || ""
                      })
                    }
                    className="rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white"
                  >
                    Onayla
                  </button> : null}
                  {canOperate ? <button
                    type="button"
                    onClick={() =>
                      void action(`missing-${ambassador.id}`, {
                        action: "missing_documents",
                        ambassadorId: ambassador.id,
                        reason: window.prompt("Eksik belge / bilgi") || ""
                      })
                    }
                    className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white"
                  >
                    Eksik Belge İste
                  </button> : null}
                  {canOperate ? <button
                    type="button"
                    onClick={() =>
                      void action(`reject-${ambassador.id}`, {
                        action: "reject",
                        ambassadorId: ambassador.id,
                        reason: window.prompt("Ret nedeni") || ""
                      })
                    }
                    className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white"
                  >
                    Reddet
                  </button> : null}
                </div>
              ) : null}

              {ambassador.contents.length ? (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-semibold">İçerikler</p>
                  {ambassador.contents.map((content) => (
                    <div
                      key={content.id}
                      className="rounded-lg border border-neutral-200 p-3 text-xs"
                    >
                      <div className="flex flex-wrap justify-between gap-2">
                        <strong>
                          {content.platform} · {content.contentType}
                          {content.isFirstContent ? " · İlk içerik" : ""}
                        </strong>
                        <span>{content.status}</span>
                      </div>
                      {content.publishedUrl ? (
                        <a
                          href={content.publishedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block break-all text-purple-700 underline"
                        >
                          {content.publishedUrl}
                        </a>
                      ) : null}
                      {content.captionText ? (
                        <p className="mt-2 whitespace-pre-wrap text-neutral-700">
                          {content.captionText}
                        </p>
                      ) : null}
                      {canReviewContent &&
                      ["SUBMITTED", "CHANGES_REQUESTED", "APPROVED"].includes(
                        content.status
                      ) ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {["APPROVED", "CHANGES_REQUESTED", "PUBLISHED"].map(
                            (status) => (
                              <button
                                key={status}
                                type="button"
                                onClick={() =>
                                  void action(`content-${content.id}-${status}`, {
                                    action: "review_content",
                                    ambassadorId: ambassador.id,
                                    contentId: content.id,
                                    status,
                                    reviewNotes:
                                      status === "CHANGES_REQUESTED"
                                        ? window.prompt("Düzeltme notu") || ""
                                        : "",
                                    productVisible: true,
                                    disclosurePresent: true,
                                    couponVisible: true,
                                    petiwellTagged: true,
                                    healthClaimsOk: true,
                                    productInfoOk: true
                                  })
                                }
                                className="rounded border border-purple-700 px-2 py-1 text-purple-800"
                              >
                                {status}
                              </button>
                            )
                          )}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {ambassador.payouts.length ? (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-semibold">Ödemeler</p>
                  {ambassador.payouts.map((payout) => (
                    <div
                      key={payout.id}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 p-3 text-xs"
                    >
                      <span>
                        {new Date(payout.periodStart).toLocaleDateString("tr-TR")} –{" "}
                        {new Date(payout.periodEnd).toLocaleDateString("tr-TR")}
                      </span>
                      <strong>
                        {Number(payout.netPayout).toLocaleString("tr-TR", {
                          style: "currency",
                          currency: "TRY"
                        })}
                      </strong>
                      <span>{payout.status}</span>
                      {payout.status === "READY" && canFinance ? (
                        <button
                          type="button"
                          onClick={() => {
                            const bankReference =
                              window.prompt("Banka işlem referansı");
                            if (!bankReference) return;
                            void action(`payout-${payout.id}`, {
                              action: "mark_payout_paid",
                              ambassadorId: ambassador.id,
                              payoutId: payout.id,
                              bankReference
                            });
                          }}
                          className="rounded border border-green-700 px-2 py-1 font-semibold text-green-800"
                        >
                          Ödendi İşaretle
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {shipment?.status === "PENDING" && canOperate ? (
                <form
                  className="mt-4 flex flex-wrap gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    void action(`ship-${ambassador.id}`, {
                      action: "ship_welcome",
                      ambassadorId: ambassador.id,
                      carrier: form.get("carrier"),
                      trackingNumber: form.get("trackingNumber")
                    });
                  }}
                >
                  <input
                    name="carrier"
                    required
                    placeholder="Kargo firması"
                    className={fieldClass}
                  />
                  <input
                    name="trackingNumber"
                    required
                    placeholder="Takip numarası"
                    className={fieldClass}
                  />
                  <button className="rounded-lg bg-purple-700 px-3 py-2 text-xs font-semibold text-white">
                    Paketi Gönder
                  </button>
                </form>
              ) : null}
              {shipment?.status === "SHIPPED" && canOperate ? (
                <button
                  type="button"
                  onClick={() =>
                    void action(`deliver-${ambassador.id}`, {
                      action: "deliver_welcome",
                      ambassadorId: ambassador.id
                    })
                  }
                  className="mt-4 rounded-lg bg-purple-700 px-3 py-2 text-xs font-semibold text-white"
                >
                  Teslim Edildi — 14 Gün Sayacını Başlat
                </button>
              ) : null}
              {canOperate && [
                "ACTIVE_PENDING_SHIPMENT",
                "ACTIVE_PENDING_FIRST_CONTENT",
                "ACTIVE",
                "FINAL_CONTENT_WARNING",
                "PAUSED"
              ].includes(ambassador.status) ? (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-neutral-200 pt-3">
                  <button
                    type="button"
                    onClick={() =>
                      void action(`state-${ambassador.id}`, {
                        action: ambassador.status === "PAUSED" ? "resume" : "pause",
                        ambassadorId: ambassador.id,
                        reason:
                          window.prompt(
                            ambassador.status === "PAUSED"
                              ? "Devam notu"
                              : "Duraklatma nedeni"
                          ) || ""
                      })
                    }
                    className="rounded border border-neutral-500 px-3 py-1 text-xs font-semibold"
                  >
                    {ambassador.status === "PAUSED" ? "Yeniden Aktif Et" : "Duraklat"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!window.confirm("Elçiliği hemen sonlandırmak istiyor musunuz?"))
                        return;
                      void action(`terminate-${ambassador.id}`, {
                        action: "terminate",
                        ambassadorId: ambassador.id,
                        reason: window.prompt("Sonlandırma nedeni") || ""
                      });
                    }}
                    className="rounded border border-red-700 px-3 py-1 text-xs font-semibold text-red-800"
                  >
                    Hemen Sonlandır
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
