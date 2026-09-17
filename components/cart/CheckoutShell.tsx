"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Dictionary } from "@/lib/dictionary";
import { Locale } from "@/lib/i18n";
import { useCart } from "@/components/cart/CartProvider";
import { formatTry } from "@/lib/commerce";
import { CityDistrictFields } from "@/components/account/CityDistrictFields";
import { ProductId } from "@/lib/product";
import { rememberCheckoutEmail, trackBeginCheckout } from "@/lib/analytics";

type CatalogItem = {
  id: string;
  shortName: string;
  priceTry: number;
  sellable: boolean;
};

type SellerIdentity = {
  legalName: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  taxOffice: string;
  taxNumber: string;
};

type Props = {
  locale: Locale;
  dict: Dictionary;
  catalog: CatalogItem[];
  shippingFlatTry: number;
  shippingFreeOverTry: number;
  paytrTestMode: boolean;
  seller: SellerIdentity;
  account?: {
    email: string;
    name: string;
    phone: string;
    shippingAddress: string;
    city: string;
    district: string;
    postalCode: string;
  } | null;
};

function shippingFor(subtotal: number, flat: number, freeOver: number) {
  if (subtotal <= 0) return 0;
  if (subtotal >= freeOver) return 0;
  return flat;
}

function errorCopy(locale: Locale, code: string): string {
  const tr: Record<string, string> = {
    sales_disabled: "Site satışı şu an kapalı.",
    company_incomplete: "Satıcı bilgileri eksik.",
    legal_not_accepted: "Sözleşme onaylarını işaretleyin.",
    empty_cart: "Sepet boş.",
    insufficient_stock: "Stok yetersiz.",
    product_not_priced: "Ürün fiyatı tanımlı değil.",
    paytr_not_configured: "Ödeme altyapısı henüz hazır değil.",
    paytr_token_failed: "PayTR ödeme ekranı açılamadı.",
    network_error: "Bağlantı hatası. Tekrar deneyin.",
    checkout_failed: "Ödeme başlatılamadı.",
    server_error: "Sunucu hatası. Tekrar deneyin.",
    promo_invalid: "Kampanya kodu geçersiz.",
    promo_exhausted: "Bu kampanya kodunun kullanım hakkı doldu.",
    promo_not_stackable:
      "Bu kampanya Elçi yönlendirmesiyle birlikte kullanılamaz.",
    invalid_location: "İl ve ilçe listeden seçilmeli."
  };
  const en: Record<string, string> = {
    sales_disabled: "Direct sales are currently closed.",
    company_incomplete: "Seller details are incomplete.",
    legal_not_accepted: "Please accept the contracts.",
    empty_cart: "Cart is empty.",
    insufficient_stock: "Not enough stock.",
    product_not_priced: "Product is not priced.",
    paytr_not_configured: "Payment is not configured yet.",
    paytr_token_failed: "PayTR payment screen could not start.",
    network_error: "Network error. Try again.",
    checkout_failed: "Checkout failed.",
    server_error: "Server error. Try again.",
    promo_invalid: "This promo code is not valid.",
    promo_exhausted: "This promo code has no remaining uses.",
    promo_not_stackable:
      "This campaign cannot be combined with an Ambassador referral.",
    invalid_location: "City and district must be selected from the list."
  };
  const table = locale === "en" ? en : tr;
  return table[code] || code;
}

export function CheckoutShell({
  locale,
  dict,
  catalog,
  shippingFlatTry,
  shippingFreeOverTry,
  paytrTestMode,
  seller,
  account
}: Props) {
  const { items, setQuantity, removeItem, count } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [sameBilling, setSameBilling] = useState(true);
  const [promoInput, setPromoInput] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discountTry: number;
    totalTry: number;
  } | null>(null);
  const [serverTotals, setServerTotals] = useState<{
    shippingTry: number;
    discountTry: number;
    totalTry: number;
    promoCode?: string | null;
  } | null>(null);

  const catalogById = useMemo(
    () => Object.fromEntries(catalog.map((p) => [p.id, p])),
    [catalog]
  );

  const lines = useMemo(
    () =>
      items.map((item) => {
        const product = catalogById[item.productId];
        const unit = product?.priceTry ?? 0;
        return {
          ...item,
          name: product?.shortName ?? item.productId,
          unitPriceTry: unit,
          lineTotalTry: unit * item.quantity,
          sellable: Boolean(product?.sellable)
        };
      }),
    [items, catalogById]
  );

  const subtotal = lines.reduce((s, l) => s + l.lineTotalTry, 0);
  const localShipping = shippingFor(
    subtotal,
    shippingFlatTry,
    shippingFreeOverTry
  );
  const shipping = serverTotals?.shippingTry ?? localShipping;
  const total = serverTotals?.totalTry ?? subtotal + localShipping;
  const loc = locale === "tr" ? "tr-TR" : "en-TR";
  const canPay = lines.length > 0 && lines.every((l) => l.sellable);

  async function quotePromo(code: string) {
    const trimmed = code.trim();
    if (!trimmed || items.length === 0) {
      setAppliedPromo(null);
      return false;
    }
    const res = await fetch("/api/checkout/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locale,
        promoCode: trimmed,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity
        }))
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!data.ok || !data.totals?.promoCode) {
      setAppliedPromo(null);
      setError(errorCopy(locale, String(data.error || "promo_invalid")));
      return false;
    }
    setAppliedPromo({
      code: String(data.totals.promoCode),
      discountTry: Number(data.totals.discountTry || 0),
      totalTry: Number(data.totals.totalTry)
    });
    setServerTotals({
      shippingTry: Number(data.totals.shippingTry || 0),
      discountTry: Number(data.totals.discountTry || 0),
      totalTry: Number(data.totals.totalTry || 0),
      promoCode: data.totals.promoCode || null
    });
    setPromoInput(String(data.totals.promoCode));
    setError(null);
    return true;
  }

  const beganCheckout = useRef(false);
  useEffect(() => {
    if (beganCheckout.current || items.length === 0) return;
    beganCheckout.current = true;
    trackBeginCheckout({
      value: total,
      items: lines.map((line) => ({
        item_id: line.productId,
        item_name: line.name,
        price: line.unitPriceTry,
        quantity: line.quantity
      }))
    });
  }, [items.length, lines, total]);

  const cartKey = items.map((i) => `${i.productId}:${i.quantity}`).join(",");

  useEffect(() => {
    if (items.length === 0) {
      setServerTotals(null);
      return;
    }
    void fetch("/api/checkout/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locale,
        promoCode: appliedPromo?.code || "",
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity
        }))
      })
    })
      .then((response) => response.json())
      .then((data) => {
        if (!data.ok) return;
        setServerTotals({
          shippingTry: Number(data.totals.shippingTry || 0),
          discountTry: Number(data.totals.discountTry || 0),
          totalTry: Number(data.totals.totalTry || 0),
          promoCode: data.totals.promoCode || null
        });
      })
      .catch(() => undefined);
    // Re-quote when cart lines or the active promo change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, appliedPromo?.code, locale]);

  async function onApplyPromo() {
    setPromoBusy(true);
    try {
      await quotePromo(promoInput);
    } catch {
      setError(errorCopy(locale, "network_error"));
    } finally {
      setPromoBusy(false);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    setToken(null);

    const fd = new FormData(e.currentTarget);
    const payload = {
      locale,
      customerName: String(fd.get("customerName") || ""),
      customerEmail: String(fd.get("customerEmail") || ""),
      customerPhone: String(fd.get("customerPhone") || ""),
      shippingAddress: String(fd.get("shippingAddress") || ""),
      billingAddress: sameBilling
        ? String(fd.get("shippingAddress") || "")
        : String(fd.get("billingAddress") || ""),
      city: String(fd.get("city") || ""),
      district: String(fd.get("district") || ""),
      postalCode: String(fd.get("postalCode") || ""),
      notes: String(fd.get("notes") || ""),
      distanceSalesAccepted: fd.get("distanceSalesAccepted") === "on",
      preInfoAccepted: fd.get("preInfoAccepted") === "on",
      privacyAccepted: fd.get("privacyAccepted") === "on",
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity
      })),
      promoCode: appliedPromo?.code || ""
    };

    rememberCheckoutEmail(payload.customerEmail);

    try {
      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok || !data.token) {
        setError(errorCopy(locale, String(data.error || "checkout_failed")));
        setBusy(false);
        return;
      }
      setToken(data.token);
    } catch {
      setError(errorCopy(locale, "network_error"));
    } finally {
      setBusy(false);
    }
  }

  if (token) {
    return (
      <section className="section-shell">
        <div className="mx-auto max-w-3xl">
          <h1 className="section-title">{dict.cart.checkout}</h1>
          <p className="mt-2 text-sm text-muted">
            Kart bilgilerinizi PayTR güvenli ödeme ekranına girin.
          </p>
          {paytrTestMode ? (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Test modu: PayTR ekranında kart bilgileri hazır gelir. Ödeme Yap →
              3D sayfasında Gönder yeterli. Gerçek kart kullanmayın.
            </p>
          ) : null}
          <iframe
            title="PayTR"
            src={`https://www.paytr.com/odeme/guvenli/${token}`}
            className="mt-6 h-[720px] w-full rounded-xl border border-line bg-white"
            frameBorder={0}
            scrolling="yes"
          />
        </div>
      </section>
    );
  }

  if (!count) {
    return (
      <section className="section-shell">
        <div className="mx-auto max-w-xl text-center">
          <h1 className="section-title">{dict.cart.title}</h1>
          <p className="section-subtitle mx-auto">{dict.cart.empty}</p>
          <Link
            href={`/${locale}#products`}
            className="mt-6 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white"
          >
            {dict.nav.products}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="section-shell">
      <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <form onSubmit={onSubmit} className="space-y-5">
          <h1 className="section-title">{dict.cart.checkout}</h1>
          {account ? (
            <p className="text-sm text-muted">
              {dict.cart.loggedInAs}: {account.email}
            </p>
          ) : (
            <p className="text-sm text-muted">
              <Link href={`/${locale}/account/login`} className="text-brand underline">
                {dict.nav.login}
              </Link>
              {" — "}
              {dict.cart.loginToPrefill}
            </p>
          )}

          <fieldset className="space-y-3 rounded-2xl border border-line bg-surface p-5">
            <legend className="px-1 text-sm font-semibold text-charcoal">
              Teslimat
            </legend>
            <input
              name="customerName"
              required
              defaultValue={account?.name || ""}
              placeholder="Ad Soyad"
              className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
            />
            <input
              name="customerEmail"
              type="email"
              required
              defaultValue={account?.email || ""}
              placeholder="E-posta"
              className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
            />
            <input
              name="customerPhone"
              required
              defaultValue={account?.phone || ""}
              placeholder="Telefon"
              className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
            />
            <textarea
              name="shippingAddress"
              required
              rows={3}
              defaultValue={account?.shippingAddress || ""}
              placeholder="Adres"
              className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <CityDistrictFields
                cityLabel={dict.account.selectCity}
                districtLabel={dict.account.selectDistrict}
                defaultCity={account?.city || ""}
                defaultDistrict={account?.district || ""}
              />
              <input
                name="postalCode"
                defaultValue={account?.postalCode || ""}
                placeholder="Posta kodu"
                className="rounded-xl border border-line px-3 py-2.5 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={sameBilling}
                onChange={(e) => setSameBilling(e.target.checked)}
              />
              Fatura adresi teslimat ile aynı
            </label>
            {!sameBilling ? (
              <textarea
                name="billingAddress"
                required
                rows={3}
                placeholder="Fatura adresi"
                className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
              />
            ) : null}
            <textarea
              name="notes"
              rows={2}
              placeholder="Sipariş notu (opsiyonel)"
              className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
            />
          </fieldset>

          <fieldset className="space-y-3 rounded-2xl border border-line bg-surface p-5 text-sm">
            <div className="rounded-xl bg-cream/60 px-3 py-3 text-xs leading-relaxed text-muted">
              <p className="font-semibold text-charcoal">
                {locale === "en" ? "Seller" : "Satıcı"}
              </p>
              <p className="mt-1 whitespace-pre-line">
                {`${seller.legalName}\n${seller.address}, ${seller.city}\n${seller.phone} · ${seller.email}\n${seller.taxOffice} / ${seller.taxNumber}`}
              </p>
            </div>
            <label className="flex items-start gap-2">
              <input name="preInfoAccepted" type="checkbox" required className="mt-1" />
              <span>
                <Link href={`/${locale}/pre-info`} className="text-brand underline">
                  {locale === "en"
                    ? "Pre-contract information form"
                    : "Ön bilgilendirme formunu"}
                </Link>{" "}
                {locale === "en"
                  ? "— I have read and accept it. I understand this creates a payment obligation."
                  : "okudum ve kabul ediyorum. Ödemenin bir ödeme yükümlülüğü doğurduğunu biliyorum."}
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input
                name="distanceSalesAccepted"
                type="checkbox"
                required
                className="mt-1"
              />
              <span>
                <Link
                  href={`/${locale}/distance-sales`}
                  className="text-brand underline"
                >
                  {locale === "en"
                    ? "Distance sales agreement"
                    : "Mesafeli satış sözleşmesini"}
                </Link>{" "}
                {locale === "en"
                  ? "and"
                  : "ile"}{" "}
                <Link
                  href={`/${locale}/shipping`}
                  className="text-brand underline"
                >
                  {locale === "en"
                    ? "delivery, 14-day withdrawal and hygiene exceptions"
                    : "teslimat, 14 günlük cayma hakkı ve hijyen istisnalarını"}
                </Link>{" "}
                {locale === "en"
                  ? "— I have read and accept them."
                  : "okudum ve kabul ediyorum."}{" "}
                <Link
                  href={`/${locale}/withdrawal`}
                  className="text-brand underline"
                >
                  {locale === "en" ? "Withdrawal form" : "Cayma formu"}
                </Link>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input name="privacyAccepted" type="checkbox" required className="mt-1" />
              <span>
                <Link href={`/${locale}/privacy`} className="text-brand underline">
                  {locale === "en"
                    ? "Privacy / KVKK notice"
                    : "Gizlilik / KVKK Aydınlatma Metnini"}
                </Link>{" "}
                {locale === "en"
                  ? "— I have read it. I understand that data needed to perform the order is processed on that basis, and that analytics/ads cookies need separate banner consent."
                  : "okudum. Siparişin ifası için zorunlu verilerin bu metne göre işleneceğini; analitik/reklam çerezlerinin ayrıca çerez bandı rızasına bağlı olduğunu anlıyorum."}
              </span>
            </label>
          </fieldset>

          {error ? (
            <p className="text-sm text-red-700">İşlem başarısız: {error}</p>
          ) : null}

          <button
            type="submit"
            disabled={busy || !canPay}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-accent-action px-5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {busy ? "..." : dict.cart.checkout}
          </button>
        </form>

        <aside className="h-fit rounded-2xl border border-line bg-surface p-5 shadow-soft">
          <h2 className="text-base font-semibold text-charcoal">{dict.cart.title}</h2>
          <ul className="mt-4 space-y-3">
            {lines.map((line) => (
              <li key={line.productId} className="flex justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium text-charcoal">{line.name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={line.quantity}
                      onChange={(e) =>
                        setQuantity(
                          line.productId as ProductId,
                          Number(e.target.value)
                        )
                      }
                      className="w-14 rounded-lg border border-line px-2 py-1 text-sm"
                    />
                    <button
                      type="button"
                      className="text-xs text-muted hover:text-brand"
                      onClick={() => removeItem(line.productId as ProductId)}
                    >
                      Kaldır
                    </button>
                  </div>
                </div>
                <p className="font-semibold">{formatTry(line.lineTotalTry, loc)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex gap-2">
              <input
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value)}
                placeholder={dict.cart.promoPlaceholder}
                autoComplete="off"
                className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-sm"
              />
              {appliedPromo ? (
                <button
                  type="button"
                  onClick={() => {
                    setAppliedPromo(null);
                    setPromoInput("");
                    setServerTotals(null);
                    setError(null);
                  }}
                  className="rounded-xl border border-line px-3 py-2 text-sm"
                >
                  {dict.cart.promoRemove}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={promoBusy || !promoInput.trim()}
                  onClick={() => void onApplyPromo()}
                  className="rounded-xl border border-line px-3 py-2 text-sm disabled:opacity-50"
                >
                  {promoBusy ? "..." : dict.cart.promoApply}
                </button>
              )}
            </div>
            <div className="flex justify-between">
              <span>{dict.cart.subtotal}</span>
              <span>{formatTry(subtotal, loc)}</span>
            </div>
            <div className="flex justify-between">
              <span>{dict.cart.shipping}</span>
              <span>{formatTry(shipping, loc)}</span>
            </div>
            {serverTotals && serverTotals.discountTry > 0 ? (
              <div className="flex justify-between text-brand">
                <span>
                  {dict.cart.discount}
                  {serverTotals.promoCode
                    ? ` (${serverTotals.promoCode})`
                    : ""}
                </span>
                <span>−{formatTry(serverTotals.discountTry, loc)}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-base font-semibold">
              <span>{dict.cart.total}</span>
              <span>{formatTry(total, loc)}</span>
            </div>
            <p className="text-[11px] text-muted pt-2">
              Toplam, ödemede sunucu tarafından yeniden hesaplanır. Kart bilgisi
              yalnızca PayTR ekranında işlenir.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
