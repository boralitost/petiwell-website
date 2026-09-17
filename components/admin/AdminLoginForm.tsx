"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    const totpCode = String(form.get("totpCode") || "");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, totpCode })
    });
    if (!res.ok) {
      setError("Şifre hatalı");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-3">
      <input
        name="email"
        type="email"
        placeholder="Admin e-postası (veritabanı hesabı)"
        autoComplete="username"
        className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
      />
      <input
        name="password"
        type="password"
        required
        placeholder="Admin şifresi"
        className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
      />
      <input
        name="totpCode"
        type="text"
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        placeholder="Authenticator 6 haneli kod"
        autoComplete="one-time-code"
        className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white"
      >
        Giriş
      </button>
    </form>
  );
}
