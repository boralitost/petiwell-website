"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { Dictionary } from "@/lib/dictionary";
import { Locale } from "@/lib/i18n";
import { useCart } from "@/components/cart/CartProvider";
import { calcShippingTry, formatTry } from "@/lib/commerce";
import { getProduct, ProductId } from "@/lib/product";

type Props = {
  locale: Locale;
  dict: Dictionary;
};

export function CheckoutShell({ locale, dict }: Props) {
  const { items, setQuantity, removeItem, count, clear } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [sameBilling, setSameBilling] = useState(true);

  const lines = useMemo(
    () =>
      items.map((item) => {
        const product = getProduct(locale, item.productId as ProductId);
        return {
          ...item,
          name: product.shortName,
          unitPriceTry: product.priceTry,
          lineTotalTry: product.priceTry * item.quantity,
          sellable: product.sellableOnSite
        };
      }),
    [items, locale]
  );

  const subtotal = lines.reduce((s, l) => s + l.lineTotalTry, 0);
  const shipping = calcShippingTry(subtotal);
  const total = subtotal + shipping;
  const loc = locale === "tr" ? "tr-TR" : "en-TR";

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
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity
      }))
    };

    try {
      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.ok || !data.token) {
        setError(data.error || "checkout_failed");
        setBusy(false);
        return;
      }
      setToken(data.token);
      clear();
    } catch {
      setError("network_error");
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

          <fieldset className="space-y-3 rounded-2xl border border-line bg-surface p-5">
            <legend className="px-1 text-sm font-semibold text-charcoal">
              Teslimat
            </legend>
            <input
              name="customerName"
              required
              placeholder="Ad Soyad"
              className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
            />
            <input
              name="customerEmail"
              type="email"
              required
              placeholder="E-posta"
              className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
            />
            <input
              name="customerPhone"
              required
              placeholder="Telefon"
              className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
            />
            <textarea
              name="shippingAddress"
              required
              rows={3}
              placeholder="Adres"
              className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                name="city"
                required
                placeholder="İl"
                className="rounded-xl border border-line px-3 py-2.5 text-sm"
              />
              <input
                name="district"
                placeholder="İlçe"
                className="rounded-xl border border-line px-3 py-2.5 text-sm"
              />
              <input
                name="postalCode"
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
            <label className="flex items-start gap-2">
              <input name="preInfoAccepted" type="checkbox" required className="mt-1" />
              <span>
                <Link href={`/${locale}/pre-info`} className="text-brand underline">
                  Ön bilgilendirme formunu
                </Link>{" "}
                okudum ve kabul ediyorum.
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
                  Mesafeli satış sözleşmesini
                </Link>{" "}
                okudum ve kabul ediyorum.
              </span>
            </label>
          </fieldset>

          {error ? (
            <p className="text-sm text-red-700">İşlem başarısız: {error}</p>
          ) : null}

          <button
            type="submit"
            disabled={busy || lines.some((l) => !l.sellable)}
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
            <div className="flex justify-between">
              <span>{dict.cart.subtotal}</span>
              <span>{formatTry(subtotal, loc)}</span>
            </div>
            <div className="flex justify-between">
              <span>{dict.cart.shipping}</span>
              <span>{formatTry(shipping, loc)}</span>
            </div>
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
