"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Dictionary } from "@/lib/dictionary";
import { Locale } from "@/lib/i18n";
import { accountErrorCopy } from "@/components/account/account-errors";

type Props = {
  locale: Locale;
  dict: Dictionary;
};

export function LoginForm({ locale, dict }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState("");

  async function finishLogin() {
    router.push(`/${locale}/account`);
    router.refresh();
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") || "");
    const confirm = String(fd.get("passwordConfirm") || "");
    if (mode === "register" && password !== confirm) {
      setError(dict.account.passwordMismatch);
      setBusy(false);
      return;
    }
    try {
      const res = await fetch(
        mode === "register" ? "/api/account/register" : "/api/account/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locale,
            email: String(fd.get("email") || ""),
            password,
            name: String(fd.get("name") || "")
          })
        }
      );
      const data = await res.json().catch(() => ({}));
      if (data.needsVerification || data.error === "email_unverified") {
        setPendingEmail(String(data.email || fd.get("email") || ""));
        setError(null);
        return;
      }
      if (!data.ok) {
        setError(accountErrorCopy(dict, String(data.error || "server_error")));
        return;
      }
      await finishLogin();
    } catch {
      setError("network_error");
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/account/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: pendingEmail,
          code: String(fd.get("code") || "")
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) {
        setError(accountErrorCopy(dict, String(data.error || "invalid_code")));
        return;
      }
      await finishLogin();
    } catch {
      setError("network_error");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    await fetch("/api/account/verify", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale, email: pendingEmail })
    });
    setBusy(false);
  }

  if (pendingEmail) {
    return (
      <form onSubmit={onVerify} className="space-y-3">
        <h2 className="text-base font-semibold">{dict.account.verifyTitle}</h2>
        <p className="text-sm text-muted">
          {dict.account.verifyLead} {pendingEmail}
        </p>
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          maxLength={6}
          placeholder={dict.account.codeLabel}
          className="w-full rounded-xl border border-line px-3 py-2.5 text-center text-lg tracking-[0.3em]"
        />
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-accent-action px-5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? dict.account.sending : dict.account.verifySubmit}
        </button>
        <button
          type="button"
          onClick={() => void resend()}
          className="w-full text-xs text-brand underline"
        >
          {dict.account.resendCode}
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 rounded-xl border border-line p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`rounded-lg py-2 font-medium ${
            mode === "login" ? "bg-brand text-white" : "text-muted"
          }`}
        >
          {dict.account.loginTitle}
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`rounded-lg py-2 font-medium ${
            mode === "register" ? "bg-brand text-white" : "text-muted"
          }`}
        >
          {dict.account.registerTitle}
        </button>
      </div>
      <p className="text-sm text-muted">
        {mode === "login" ? dict.account.loginLead : dict.account.registerLead}
      </p>
      <form onSubmit={onSubmit} className="space-y-3">
        {mode === "register" ? (
          <input
            name="name"
            required
            autoComplete="name"
            placeholder={dict.account.name}
            className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
          />
        ) : null}
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={dict.account.email}
          className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
        />
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          placeholder={dict.account.password}
          className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
        />
        {mode === "register" ? (
          <input
            name="passwordConfirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder={dict.account.passwordConfirm}
            className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
          />
        ) : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-accent-action px-5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {busy
            ? dict.account.sending
            : mode === "register"
              ? dict.account.submitRegister
              : dict.account.submitLogin}
        </button>
      </form>
      <Link
        href={`/${locale}/account/forgot`}
        className="block text-center text-xs text-brand underline"
      >
        {dict.account.forgotPassword}
      </Link>
    </div>
  );
}
