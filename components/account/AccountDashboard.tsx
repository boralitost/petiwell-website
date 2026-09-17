"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Dictionary } from "@/lib/dictionary";
import { formatTry } from "@/lib/commerce";
import type { AccountUser } from "@/lib/account";
import { accountErrorCopy } from "@/components/account/account-errors";
import { CityDistrictFields } from "@/components/account/CityDistrictFields";

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalTry: { toString(): string } | number | string;
  createdAt: string | Date;
  items: { productName: string; quantity: number }[];
};

type Props = {
  dict: Dictionary;
  locale: string;
  user: AccountUser;
  orders: OrderRow[];
};

const STATUS: Record<string, { tr: string; en: string }> = {
  pending_payment: { tr: "Ödeme bekleniyor", en: "Awaiting payment" },
  paid: { tr: "Ödendi", en: "Paid" },
  preparing: { tr: "Hazırlanıyor", en: "Preparing" },
  shipped: { tr: "Kargoda", en: "Shipped" },
  delivered: { tr: "Teslim edildi", en: "Delivered" },
  cancelled: { tr: "İptal", en: "Cancelled" },
  refunded: { tr: "İade", en: "Refunded" }
};

export function AccountDashboard({ dict, locale, user, orders }: Props) {
  const router = useRouter();
  const loc = locale === "en" ? "en-TR" : "tr-TR";
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordCodeSent, setPasswordCodeSent] = useState(false);

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(fd.get("name") || ""),
          phone: String(fd.get("phone") || ""),
          address: String(fd.get("address") || ""),
          city: String(fd.get("city") || ""),
          district: String(fd.get("district") || ""),
          postalCode: String(fd.get("postalCode") || "")
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) {
        setError(accountErrorCopy(dict, String(data.error || "server_error")));
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("network_error");
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    await fetch("/api/account/logout", { method: "POST" });
    router.push(`/${locale}`);
    router.refresh();
  }

  async function onClose() {
    if (!window.confirm(dict.account.closeAccountConfirm)) return;
    await fetch("/api/account/profile", { method: "DELETE" });
    router.push(`/${locale}`);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="section-title">{dict.account.title}</h1>
          <p className="mt-1 text-sm text-muted">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={() => void onLogout()}
          className="rounded-full border border-line px-4 py-2 text-sm"
        >
          {dict.account.logout}
        </button>
      </div>

      <form
        onSubmit={onSave}
        className="space-y-3 rounded-2xl border border-line bg-surface p-5"
      >
        <h2 className="text-sm font-semibold">{dict.account.profile}</h2>
        <input
          name="name"
          defaultValue={user.name}
          required
          placeholder={dict.account.name}
          className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
        />
        <input
          name="phone"
          defaultValue={user.phone}
          placeholder={dict.account.phone}
          className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
        />
        <h2 className="pt-2 text-sm font-semibold">{dict.account.addressTitle}</h2>
        <textarea
          name="address"
          defaultValue={user.address?.address || ""}
          rows={3}
          placeholder={dict.account.address}
          className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <CityDistrictFields
            cityLabel={dict.account.selectCity}
            districtLabel={dict.account.selectDistrict}
            defaultCity={user.address?.city || ""}
            defaultDistrict={user.address?.district || ""}
          />
          <input
            name="postalCode"
            defaultValue={user.address?.postalCode || ""}
            placeholder={dict.account.postalCode}
            className="rounded-xl border border-line px-3 py-2.5 text-sm"
          />
        </div>
        {saved ? <p className="text-sm text-green-700">{dict.account.saved}</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-accent-action px-5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {dict.account.save}
        </button>
      </form>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setSaved(false);
          setError(null);
          try {
            if (!passwordCodeSent) {
              const res = await fetch("/api/account/password", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ locale })
              });
              const data = await res.json().catch(() => ({}));
              if (!data.ok) {
                setError(accountErrorCopy(dict, String(data.error || "server_error")));
                return;
              }
              setPasswordCodeSent(true);
              return;
            }
            const fd = new FormData(e.currentTarget);
            const nextPassword = String(fd.get("nextPassword") || "");
            const confirm = String(fd.get("passwordConfirm") || "");
            if (nextPassword !== confirm) {
              setError(dict.account.passwordMismatch);
              return;
            }
            const res = await fetch("/api/account/password", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                code: String(fd.get("code") || ""),
                nextPassword
              })
            });
            const data = await res.json().catch(() => ({}));
            if (!data.ok) {
              setError(accountErrorCopy(dict, String(data.error || "server_error")));
              return;
            }
            setSaved(true);
            setPasswordCodeSent(false);
            e.currentTarget.reset();
          } catch {
            setError("network_error");
          } finally {
            setBusy(false);
          }
        }}
        className="space-y-3 rounded-2xl border border-line bg-surface p-5"
      >
        <h2 className="text-sm font-semibold">{dict.account.changePassword}</h2>
        {passwordCodeSent ? (
          <>
            <p className="text-sm text-muted">{dict.account.verifyLead}</p>
            <input
              name="code"
              inputMode="numeric"
              required
              maxLength={6}
              placeholder={dict.account.codeLabel}
              className="w-full rounded-xl border border-line px-3 py-2.5 text-center text-lg tracking-[0.3em]"
            />
            <input
              name="nextPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder={dict.account.newPassword}
              className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
            />
            <input
              name="passwordConfirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder={dict.account.passwordConfirm}
              className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
            />
          </>
        ) : (
          <p className="text-sm text-muted">{dict.account.forgotLead}</p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-line px-5 text-sm font-semibold disabled:opacity-50"
        >
          {passwordCodeSent ? dict.account.changePassword : dict.account.sendCode}
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{dict.account.orders}</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-muted">{dict.account.noOrders}</p>
        ) : (
          <ul className="space-y-3">
            {orders.map((order) => {
              const label = STATUS[order.status] || { tr: order.status, en: order.status };
              return (
                <li
                  key={order.id}
                  className="rounded-2xl border border-line bg-surface p-4 text-sm"
                >
                  <div className="flex justify-between gap-3">
                    <p className="font-semibold">{order.orderNumber}</p>
                    <p className="font-semibold">
                      {formatTry(Number(order.totalTry), loc)}
                    </p>
                  </div>
                  <p className="mt-1 text-muted">
                    {locale === "en" ? label.en : label.tr}
                    {" · "}
                    {new Date(order.createdAt).toLocaleDateString(loc)}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {order.items
                      .map((item) => `${item.productName} ×${item.quantity}`)
                      .join(", ")}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <button
        type="button"
        onClick={() => void onClose()}
        className="text-xs text-muted underline"
      >
        {dict.account.closeAccount}
      </button>
    </div>
  );
}
