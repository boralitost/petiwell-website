"use client";

import { FormEvent, useMemo, useState } from "react";
import type {
  AmbassadorConsentAction,
  AmbassadorConsentType
} from "@prisma/client";
import { CityDistrictFields } from "@/components/account/CityDistrictFields";
import type { Locale } from "@/lib/i18n";

type Props = {
  locale: Locale;
  token: string;
  invite: {
    firstName: string;
    lastName: string;
    email: string;
    socialHandle: string;
    expiresAt: string;
  };
  initial: {
    firstName: string;
    lastName: string;
    birthDate: string;
    email: string;
    emailVerified: boolean;
    phone: string;
    shippingAddress: string;
    city: string;
    district: string;
    postalCode: string;
    primarySocialPlatform: string;
    instagramUsername: string;
    tiktokUsername: string;
    youtubeUsername: string;
    otherSocialUrl: string;
    taxType: string;
    taxIdLast4: string;
    ibanLast4: string;
    ibanHolderName: string;
    bankOwnershipConfirmed: boolean;
    hasTaxDocument: boolean;
    status: string;
  } | null;
  documents: {
    type: AmbassadorConsentType;
    title: string;
    version: string;
    action: AmbassadorConsentAction;
    body: string;
  }[];
};

const STAGES = ["Bilgiler", "Vergi", "Program", "Belgeler", "Tamamla"];
const inputClass =
  "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm";
const cardClass = "rounded-2xl border border-line bg-surface p-5 shadow-soft";

const ERROR_COPY: Record<string, string> = {
  invalid_invite: "Davet geçersiz veya süresi dolmuş.",
  invite_email_mismatch: "Bu davet farklı bir e-posta adresine gönderilmiş.",
  invalid_email: "Geçerli bir e-posta yazın.",
  invalid_phone: "Türkiye formatında geçerli bir telefon yazın.",
  under_18: "Programa yalnızca 18 yaşını doldurmuş kişiler katılabilir.",
  invalid_location: "İl ve ilçeyi listeden seçin.",
  social_required: "En az bir sosyal medya hesabı yazın.",
  required_fields: "Zorunlu alanları doldurun.",
  invalid_tckn: "T.C. Kimlik Numarası geçerli değil.",
  invalid_tax_id: "Vergi Kimlik No / TCKN geçerli değil.",
  invalid_iban: "Türkiye IBAN bilgisi geçerli değil.",
  iban_holder_required: "IBAN hesap sahibini yazın.",
  bank_confirmation_required: "Banka hesabının size ait olduğunu onaylayın.",
  business_fields_required: "İşletme ve fatura alanlarını tamamlayın.",
  invalid_code: "Doğrulama kodu hatalı veya süresi dolmuş.",
  email_not_verified: "E-posta doğrulamasını tamamlayın.",
  tax_document_required: "20/B istisna belgesini yükleyin.",
  consents_required: "Zorunlu belgelerin tamamını okuyup işaretleyin.",
  document_type_not_allowed: "Yalnızca PDF, JPG veya PNG yüklenebilir.",
  document_size_invalid: "Dosya boyutu izin verilen sınırda değil.",
  document_signature_invalid: "Dosya içeriği uzantısıyla uyuşmuyor.",
  document_malware_detected: "Dosya güvenlik kontrolünden geçemedi.",
  document_scan_failed: "Dosya güvenlik kontrolü tamamlanamadı.",
  document_scanner_not_configured: "Belge güvenlik servisi henüz hazır değil.",
  ambassador_storage_not_configured: "Güvenli belge depolama henüz hazır değil.",
  onboarding_locked: "Bu başvuru artık düzenlemeye kapalı.",
  network_error: "Bağlantı hatası. Tekrar deneyin."
};

function messageFor(code: string) {
  return ERROR_COPY[code] || code || "İşlem tamamlanamadı.";
}

export function AmbassadorOnboarding({
  token,
  invite,
  initial,
  documents
}: Props) {
  const [screen, setScreen] = useState(
    initial?.status === "REVIEW_PENDING" ? 6 : 0
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(
    Boolean(initial?.emailVerified)
  );
  const [verifiedEmail, setVerifiedEmail] = useState(
    initial?.emailVerified ? initial.email.toLowerCase() : ""
  );
  const [profileEmail, setProfileEmail] = useState(
    initial?.email || invite.email
  );
  const [taxType, setTaxType] = useState(
    initial?.taxType || "SOCIAL_CREATOR_20B"
  );
  const [taxSaved, setTaxSaved] = useState(Boolean(initial?.taxIdLast4));
  const [documentUploaded, setDocumentUploaded] = useState(false);
  const [accepted, setAccepted] = useState<Set<AmbassadorConsentType>>(
    new Set()
  );
  const [opened, setOpened] = useState<Set<AmbassadorConsentType>>(new Set());
  const [openDocument, setOpenDocument] = useState<AmbassadorConsentType | null>(
    null
  );
  const activeDocument = useMemo(
    () => documents.find((document) => document.type === openDocument) || null,
    [documents, openDocument]
  );

  async function jsonRequest(method: string, payload: Record<string, unknown>) {
    const response = await fetch(`/api/ambassador/onboarding/${token}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!data.ok) throw new Error(String(data.error || "network_error"));
    return data;
  }

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const currentEmail = String(form.get("email") || "")
      .trim()
      .toLowerCase();
    try {
      await jsonRequest("PATCH", {
        action: "profile",
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        birthDate: form.get("birthDate"),
        email: form.get("email"),
        phone: form.get("phone"),
        shippingAddress: form.get("shippingAddress"),
        city: form.get("city"),
        district: form.get("district"),
        postalCode: form.get("postalCode"),
        primarySocialPlatform: form.get("primarySocialPlatform"),
        instagramUsername: form.get("instagramUsername"),
        tiktokUsername: form.get("tiktokUsername"),
        youtubeUsername: form.get("youtubeUsername"),
        otherSocialUrl: form.get("otherSocialUrl")
      });
      setProfileEmail(currentEmail);
      if (!emailVerified || verifiedEmail !== currentEmail) {
        setEmailVerified(false);
        await jsonRequest("POST", { action: "send_code" });
        setCodeSent(true);
      } else {
        setScreen(2);
      }
    } catch (err) {
      setError(messageFor(err instanceof Error ? err.message : "network_error"));
    } finally {
      setBusy(false);
    }
  }

  async function verifyEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      await jsonRequest("POST", {
        action: "verify_code",
        code: form.get("code")
      });
      setEmailVerified(true);
      setVerifiedEmail(profileEmail.toLowerCase());
      setCodeSent(false);
      setScreen(2);
    } catch (err) {
      setError(messageFor(err instanceof Error ? err.message : "network_error"));
    } finally {
      setBusy(false);
    }
  }

  async function saveTax(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      await jsonRequest("PATCH", {
        action: "tax",
        taxType,
        taxId: form.get("taxId"),
        taxOffice: form.get("taxOffice"),
        businessName: form.get("businessName"),
        invoiceAddress: form.get("invoiceAddress"),
        iban: form.get("iban"),
        ibanHolderName: form.get("ibanHolderName"),
        bankOwnershipConfirmed: form.get("bankOwnershipConfirmed") === "on"
      });
      setTaxSaved(true);
    } catch (err) {
      setError(messageFor(err instanceof Error ? err.message : "network_error"));
    } finally {
      setBusy(false);
    }
  }

  async function uploadDocument(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    form.set(
      "documentType",
      taxType === "SOCIAL_CREATOR_20B" ? "TAX_20B" : "TAX_CERTIFICATE"
    );
    try {
      const response = await fetch(
        `/api/ambassador/onboarding/${token}/documents`,
        { method: "POST", body: form }
      );
      const data = await response.json().catch(() => ({}));
      if (!data.ok) throw new Error(String(data.error || "network_error"));
      setDocumentUploaded(true);
    } catch (err) {
      setError(messageFor(err instanceof Error ? err.message : "network_error"));
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    setBusy(true);
    setError("");
    try {
      await jsonRequest("POST", {
        action: "submit",
        acceptedTypes: [...accepted]
      });
      setScreen(6);
    } catch (err) {
      setError(messageFor(err instanceof Error ? err.message : "network_error"));
    } finally {
      setBusy(false);
    }
  }

  const stageIndex = Math.max(0, Math.min(4, screen - 1));

  return (
    <section className="section-shell">
      <div className="mx-auto max-w-2xl space-y-5">
        {screen > 0 && screen < 6 ? (
          <div aria-label="Başvuru ilerlemesi">
            <div className="mb-2 flex justify-between text-[11px] text-muted">
              {STAGES.map((label, index) => (
                <span
                  key={label}
                  className={index <= stageIndex ? "font-semibold text-brand" : ""}
                >
                  {index + 1} {label}
                </span>
              ))}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-brand-soft">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${((stageIndex + 1) / STAGES.length) * 100}%` }}
              />
            </div>
          </div>
        ) : null}

        {screen === 0 ? (
          <div className={`${cardClass} text-center`}>
            <p className="text-4xl">🐱</p>
            <h1 className="mt-3 text-2xl font-semibold text-charcoal">
              Petiwell Marka Elçiliğine Hoş Geldin
            </h1>
            <p className="mt-3 text-sm text-muted">
              Seni Petiwell Marka Elçiliği Programına davet etmekten mutluluk
              duyuyoruz.
            </p>
            <ul className="mx-auto mt-5 max-w-lg space-y-2 text-left text-sm">
              <li>✓ İki Petiwell ürünü ücretsiz başlangıç paketi</li>
              <li>✓ Sana özel %10 indirim kodu</li>
              <li>✓ Geçerli web sitesi satışlarından %15 komisyon</li>
              <li>✓ İlk içerikten sonra aylık zorunlu paylaşım kotası yok</li>
            </ul>
            <p className="mt-4 text-sm font-medium">
              Paketi teslim aldıktan sonra 14 gün içinde bir kalıcı içerik
              bekliyoruz.
            </p>
            <button
              type="button"
              onClick={() => setScreen(1)}
              className="mt-6 min-h-[48px] rounded-full bg-brand px-8 text-sm font-semibold text-white"
            >
              Devam Et
            </button>
          </div>
        ) : null}

        {screen === 1 && !codeSent ? (
          <form onSubmit={saveProfile} className={`${cardClass} space-y-4`}>
            <div>
              <h1 className="text-xl font-semibold">Temel bilgiler</h1>
              <p className="mt-1 text-sm text-muted">
                Başlangıç paketini gönderebilmek için zorunlu alanları doldur.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                name="firstName"
                required
                defaultValue={initial?.firstName || invite.firstName}
                placeholder="Ad"
                autoComplete="given-name"
                className={inputClass}
              />
              <input
                name="lastName"
                required
                defaultValue={initial?.lastName || invite.lastName}
                placeholder="Soyad"
                autoComplete="family-name"
                className={inputClass}
              />
              <label className="text-xs text-muted">
                Doğum tarihi
                <input
                  name="birthDate"
                  type="date"
                  required
                  defaultValue={initial?.birthDate || ""}
                  className={`${inputClass} mt-1`}
                />
              </label>
              <input
                name="email"
                type="email"
                required
                readOnly={Boolean(invite.email)}
                defaultValue={initial?.email || invite.email}
                placeholder="E-posta"
                autoComplete="email"
                className={inputClass}
              />
              <input
                name="phone"
                required
                defaultValue={initial?.phone || ""}
                placeholder="05xx xxx xx xx"
                inputMode="tel"
                autoComplete="tel"
                className={inputClass}
              />
              <input
                name="postalCode"
                defaultValue={initial?.postalCode || ""}
                placeholder="Posta kodu"
                className={inputClass}
              />
            </div>
            <textarea
              name="shippingAddress"
              required
              rows={3}
              defaultValue={initial?.shippingAddress || ""}
              placeholder="Teslimat adresi"
              autoComplete="street-address"
              className={inputClass}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <CityDistrictFields
                cityLabel="İl seçin"
                districtLabel="İlçe seçin"
                defaultCity={initial?.city || ""}
                defaultDistrict={initial?.district || ""}
              />
            </div>
            <div className="border-t border-line pt-4">
              <h2 className="font-semibold">Sosyal medya hesapları</h2>
              <p className="mt-1 text-xs text-muted">
                En az bir hesap zorunludur. Yalnızca kamuya açık program
                bilgileri değerlendirilir.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                name="instagramUsername"
                defaultValue={
                  initial?.instagramUsername ||
                  (invite.socialHandle.startsWith("@") ? invite.socialHandle : "")
                }
                placeholder="Instagram @kullaniciadi"
                className={inputClass}
              />
              <input
                name="tiktokUsername"
                defaultValue={initial?.tiktokUsername || ""}
                placeholder="TikTok @kullaniciadi"
                className={inputClass}
              />
              <input
                name="youtubeUsername"
                defaultValue={initial?.youtubeUsername || ""}
                placeholder="YouTube kanal adı / URL"
                className={inputClass}
              />
              <input
                name="otherSocialUrl"
                defaultValue={initial?.otherSocialUrl || ""}
                placeholder="Diğer hesap (opsiyonel)"
                className={inputClass}
              />
            </div>
            <select
              name="primarySocialPlatform"
              required
              defaultValue={initial?.primarySocialPlatform || ""}
              className={inputClass}
            >
              <option value="">Ana içerik hesabın</option>
              <option value="Instagram">Instagram</option>
              <option value="TikTok">TikTok</option>
              <option value="YouTube">YouTube</option>
              <option value="Diğer">Diğer</option>
            </select>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <button
              disabled={busy}
              className="min-h-[48px] w-full rounded-full bg-brand text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Kaydediliyor…" : "Kaydet ve Devam Et"}
            </button>
          </form>
        ) : null}

        {screen === 1 && codeSent ? (
          <form onSubmit={verifyEmail} className={`${cardClass} space-y-4`}>
            <h1 className="text-xl font-semibold">E-postanı doğrula</h1>
            <p className="text-sm text-muted">
              E-posta adresine gönderdiğimiz 6 haneli kodu yaz.
            </p>
            <input
              name="code"
              required
              minLength={6}
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              className={`${inputClass} text-center text-xl tracking-[0.3em]`}
            />
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <button
              disabled={busy}
              className="min-h-[48px] w-full rounded-full bg-brand text-sm font-semibold text-white disabled:opacity-50"
            >
              Doğrula ve Devam Et
            </button>
          </form>
        ) : null}

        {screen === 2 ? (
          <div className="space-y-4">
            {!taxSaved ? (
              <form onSubmit={saveTax} className={`${cardClass} space-y-4`}>
                <h1 className="text-xl font-semibold">
                  Komisyon ödemeni nasıl alacaksın?
                </h1>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setTaxType("SOCIAL_CREATOR_20B")}
                    className={`rounded-xl border p-4 text-left text-sm ${
                      taxType === "SOCIAL_CREATOR_20B"
                        ? "border-brand bg-brand-soft"
                        : "border-line"
                    }`}
                  >
                    <strong>GVK Mükerrer 20/B</strong>
                    <span className="mt-1 block text-xs text-muted">
                      İstisna belgesi ve özel banka hesabı gerekir.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaxType("BUSINESS_INVOICE")}
                    className={`rounded-xl border p-4 text-left text-sm ${
                      taxType === "BUSINESS_INVOICE"
                        ? "border-brand bg-brand-soft"
                        : "border-line"
                    }`}
                  >
                    <strong>Fatura düzenleyen işletme</strong>
                    <span className="mt-1 block text-xs text-muted">
                      Vergi ve fatura bilgileri gerekir.
                    </span>
                  </button>
                </div>
                <input
                  name="taxId"
                  required
                  inputMode="numeric"
                  placeholder={
                    taxType === "SOCIAL_CREATOR_20B"
                      ? "T.C. Kimlik Numarası"
                      : "Vergi Kimlik No / TCKN"
                  }
                  className={inputClass}
                />
                {taxType === "BUSINESS_INVOICE" ? (
                  <>
                    <input
                      name="businessName"
                      required
                      placeholder="Ticari unvan / Ad Soyad"
                      className={inputClass}
                    />
                    <input
                      name="taxOffice"
                      required
                      placeholder="Vergi dairesi"
                      className={inputClass}
                    />
                    <textarea
                      name="invoiceAddress"
                      required
                      rows={3}
                      placeholder="Fatura adresi"
                      className={inputClass}
                    />
                  </>
                ) : null}
                <input
                  name="iban"
                  required
                  placeholder="TR IBAN"
                  autoComplete="off"
                  className={inputClass}
                />
                <input
                  name="ibanHolderName"
                  required
                  defaultValue={initial?.ibanHolderName || ""}
                  placeholder="IBAN hesap sahibi"
                  autoComplete="name"
                  className={inputClass}
                />
                <label className="flex gap-2 text-sm">
                  <input name="bankOwnershipConfirmed" type="checkbox" required />
                  Bu banka hesabının kendi adıma kayıtlı olduğunu onaylıyorum.
                </label>
                <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                  Sistem yalnızca biçim kontrolü yapar. Vergi belgesi ve banka
                  bilgileri Petiwell tarafından ayrıca doğrulanır.
                </p>
                {error ? <p className="text-sm text-red-700">{error}</p> : null}
                <button
                  disabled={busy}
                  className="min-h-[48px] w-full rounded-full bg-brand text-sm font-semibold text-white disabled:opacity-50"
                >
                  Vergi ve banka bilgilerini güvenli kaydet
                </button>
              </form>
            ) : (
              <div className={`${cardClass} space-y-3`}>
                <h1 className="text-xl font-semibold">Bilgiler güvenli kaydedildi</h1>
                <p className="text-sm text-muted">
                  Vergi no sonu: •••• {initial?.taxIdLast4 || "kaydedildi"} ·
                  IBAN sonu: •••• {initial?.ibanLast4 || "kaydedildi"}
                </p>
              </div>
            )}
            {taxSaved ? (
              <form onSubmit={uploadDocument} className={`${cardClass} space-y-3`}>
                <h2 className="font-semibold">
                  {taxType === "SOCIAL_CREATOR_20B"
                    ? "20/B İstisna Belgesi"
                    : "Vergi Levhası / Destekleyici Belge"}
                </h2>
                <p className="text-xs text-muted">
                  PDF, JPG veya PNG. Dosya private saklanır ve güvenlik
                  taramasından geçer.
                </p>
                <input
                  name="file"
                  type="file"
                  required={taxType === "SOCIAL_CREATOR_20B"}
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  className={inputClass}
                />
                {documentUploaded ? (
                  <p className="text-sm text-green-700">Belge güvenli yüklendi.</p>
                ) : null}
                {error ? <p className="text-sm text-red-700">{error}</p> : null}
                <div className="flex gap-3">
                  <button
                    disabled={busy}
                    className="min-h-[44px] flex-1 rounded-full border border-brand text-sm font-semibold text-brand"
                  >
                    Belgeyi yükle
                  </button>
                  <button
                    type="button"
                    disabled={
                      taxType === "SOCIAL_CREATOR_20B" &&
                      !documentUploaded &&
                      !initial?.hasTaxDocument
                    }
                    onClick={() => setScreen(3)}
                    className="min-h-[44px] flex-1 rounded-full bg-brand text-sm font-semibold text-white disabled:opacity-40"
                  >
                    Devam Et
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        ) : null}

        {screen === 3 ? (
          <div className={`${cardClass} space-y-5`}>
            <h1 className="text-xl font-semibold">Programın kısa özeti</h1>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Müşterin", "%10 indirim"],
                ["Sen", "%15 komisyon"],
                ["Ödeme", "Ayın 1’i ve 15’i"],
                ["Minimum ödeme", "500 TL"],
                ["İlk içerik", "Teslimden sonra 14 gün"],
                ["Aylık kota", "Yok"]
              ].map(([title, value]) => (
                <div key={title} className="rounded-xl bg-brand-soft p-4">
                  <p className="text-xs text-muted">{title}</p>
                  <p className="mt-1 font-semibold text-brand">{value}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted">
              Komisyon, tüm ürün indirimlerinden sonra kalan kargo hariç KDV
              hariç ürün bedelinin %15’i üzerinden hesaplanır. Yalnızca
              petiwell.com satışları geçerlidir.
            </p>
            <div className="border-t border-line pt-4">
              <h2 className="font-semibold">İçerik üretirken</h2>
              <ul className="mt-2 space-y-2 text-sm">
                <li>✓ Ürün, kupon kodu ve Petiwell etiketi görünmeli</li>
                <li>✓ “Reklam | Petiwell ile iş birliği” ibaresi bulunmalı</li>
                <li>✓ İlk içerik yayımdan önce Petiwell’e gönderilmeli</li>
                <li>✓ Yasak veya kanıtlanmamış sağlık iddiası yapılmamalı</li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => setScreen(4)}
              className="min-h-[48px] w-full rounded-full bg-brand text-sm font-semibold text-white"
            >
              Belgeleri Oku
            </button>
          </div>
        ) : null}

        {screen === 4 ? (
          <div className={`${cardClass} space-y-4`}>
            <h1 className="text-xl font-semibold">Zorunlu belgeler</h1>
            <p className="text-sm text-muted">
              Onay kutusu, ilgili belgeyi açıp okuduktan sonra aktif olur. KVKK
              metninin okunması açık rıza değildir; programın ifası için zorunlu
              veriler sözleşmeye dayanır.
            </p>
            {documents.map((document) => (
              <div
                key={document.type}
                className="rounded-xl border border-line p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{document.title}</p>
                    <p className="mt-1 text-[11px] text-muted">
                      Sürüm {document.version}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOpened((current) => {
                        const next = new Set(current);
                        next.add(document.type);
                        return next;
                      });
                      setOpenDocument(document.type);
                    }}
                    className="shrink-0 text-sm font-semibold text-brand underline"
                  >
                    Oku
                  </button>
                </div>
                <label className="mt-3 flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    disabled={!opened.has(document.type)}
                    checked={accepted.has(document.type)}
                    onChange={(event) => {
                      const next = new Set(accepted);
                      if (event.target.checked) next.add(document.type);
                      else next.delete(document.type);
                      setAccepted(next);
                    }}
                  />
                  {document.type === "KVKK_NOTICE"
                    ? "KVKK Aydınlatma Metnini okudum."
                    : "Belgeyi okudum ve programa katıldığım sürece kabul ediyorum."}
                </label>
              </div>
            ))}
            <button
              type="button"
              disabled={accepted.size !== documents.length}
              onClick={() => setScreen(5)}
              className="min-h-[48px] w-full rounded-full bg-brand text-sm font-semibold text-white disabled:opacity-40"
            >
              Son Beyanlara Geç
            </button>
          </div>
        ) : null}

        {screen === 5 ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void complete();
            }}
            className={`${cardClass} space-y-4`}
          >
            <h1 className="text-xl font-semibold">Son beyanlar</h1>
            {[
              "18 yaşını doldurdum; işçi, acente veya ticari temsilci olmadığımı, bağımsız iş gördüğümü kabul ederim.",
              "Petiwell’e verdiğim kimlik, iletişim, vergi ve banka bilgilerinin doğru ve bana ait olduğunu onaylıyorum.",
              "Vergi statümde veya banka bilgilerimde değişiklik olursa derhâl bildireceğim. 20/B veya fatura beyanımın doğruluğundan ve kendi vergi yükümlülüğümden sorumluyum; Petiwell vergi danışmanlığı vermez.",
              "Petiwell adına sipariş, ödeme, iade veya müşteri kişisel verisi alamayacağımı biliyorum.",
              "Kendi kodum veya referral’ımla kendi alışverişimden komisyon kazanamayacağımı biliyorum.",
              "Paketi teslim aldıktan sonra 14 gün içinde kalıcı içerik paylaşacağımı ve ilk içeriği yayımdan önce sunacağımı biliyorum.",
              "Ücret, komisyon veya bedelsiz ürün karşılığı her paylaşımda “Reklam | Petiwell ile iş birliği” ibaresini ilk bakışta görünür şekilde koyacağım.",
              "Tedavi, teşhis, veteriner yerine geçme veya kanıtlanmamış sağlık iddiası yapmayacağım.",
              "Program içeriğimde Petiwell’e tanıtım ve ispat amaçlı gayri münhasır lisans verdiğimi kabul ederim.",
              "Gelir veya satış garantisi olmadığını; komisyonun yalnızca petiwell.com nitelikli satışlarından doğacağını biliyorum."
            ].map((text) => (
              <label key={text} className="flex gap-2 text-sm">
                <input type="checkbox" required />
                {text}
              </label>
            ))}
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <button
              disabled={busy}
              className="min-h-[52px] w-full rounded-full bg-accent-action text-base font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Gönderiliyor…" : "Başvuruyu Tamamla"}
            </button>
          </form>
        ) : null}

        {screen === 6 ? (
          <div className={`${cardClass} py-10 text-center`}>
            <p className="text-4xl">🎉</p>
            <h1 className="mt-3 text-2xl font-semibold">Başvurun alındı</h1>
            <p className="mt-3 text-sm text-muted">
              Petiwell ekibi bilgilerini kontrol ettikten sonra seni e-posta
              yoluyla bilgilendirecek.
            </p>
          </div>
        ) : null}

        {activeDocument ? (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-3 sm:items-center"
          >
            <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{activeDocument.title}</h2>
                  <p className="text-xs text-muted">
                    Sürüm {activeDocument.version}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenDocument(null)}
                  className="rounded-full border border-line px-3 py-1 text-sm"
                >
                  Kapat
                </button>
              </div>
              <div className="mt-5 whitespace-pre-wrap text-sm leading-6 text-charcoal">
                {activeDocument.body}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
