/** Resend From must be the verified domain. This is not a mailbox. */
export const DEFAULT_EMAIL_FROM = "Petiwell <noreply@petiwell.com>";
export const DEFAULT_SHOP_NOTIFY = "petiwelltr@gmail.com";

export function resolveEmailFrom(raw?: string | null): string | null {
  const from = (raw || "").trim();
  if (/@gmail\.com/i.test(from)) return null;
  if (!from || /resend\.dev/i.test(from) || /siparis@/i.test(from)) {
    return DEFAULT_EMAIL_FROM;
  }
  return from;
}

/** Shop copy of order mail — real inbox, not a placeholder @petiwell.com address. */
export function resolveShopNotify(
  raw?: string | null,
  companyEmail?: string | null
): string {
  const notify = (raw || "").trim().toLowerCase();
  const fallback = (companyEmail || DEFAULT_SHOP_NOTIFY).trim().toLowerCase();
  if (
    !notify ||
    notify === "hello@petiwell.com" ||
    notify.startsWith("siparis@") ||
    notify.startsWith("noreply@")
  ) {
    return fallback;
  }
  return notify;
}

