"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Dictionary } from "@/lib/dictionary";
import { Locale } from "@/lib/i18n";
import { accountErrorCopy } from "@/components/account/account-errors";

type Props = {
  locale: Locale;
  dict: Dictionary;
};

export function ForgotForm({ locale, dict }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRequest(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const nextEmail = String(fd.get("email") || "");
    try {
      const res = await fetch("/api/account/login-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, email: nextEmail })
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) {
        setError(accountErrorCopy(dict, String(data.error || "server_error")));
        return;
      }
      setEmail(nextEmail);
      setSent(true);
    } catch {
      setError("network_error");
    } finally {
      setBusy(false);
    }
  }

  async function onReset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") || "");
    const confirm = String(fd.get("passwordConfirm") || "");
    if (password !== confirm) {
      setError(dict.account.passwordMismatch);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          code: String(fd.get("code") || ""),
          password
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) {
        setError(accountErrorCopy(dict, String(data.error || "invalid_code")));
        return;
      }
      router.push(`/${locale}/account`);
      router.refresh();
    } catch {
      setError("network_error");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <form onSubmit={onReset} className="space-y-3">
        <p className="text-sm text-muted">{dict.account.checkInbox}</p>
        <input
          name="code"
          inputMode="numeric"
          required
          maxLength={6}
          placeholder={dict.account.codeLabel}
          className="w-full rounded-xl border border-line px-3 py-2.5 text-center text-lg tracking-[0.3em]"
        />
        <input
          name="password"
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
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-accent-action px-5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? dict.account.sending : dict.account.resetSubmit}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={onRequest} className="space-y-3">
      <input
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder={dict.account.email}
        className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
      />
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-accent-action px-5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? dict.account.sending : dict.account.sendCode}
      </button>
    </form>
  );
}
