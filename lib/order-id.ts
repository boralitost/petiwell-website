import { randomBytes } from "crypto";

export function generateOrderNumber(): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = randomBytes(3).toString("hex").toUpperCase();
  return `PW-${stamp}-${rand}`;
}

export function isPetiwellOrderNumber(value: string): boolean {
  return /^PW-\d{8}-[A-F0-9]{6}$/i.test(value.trim());
}

/** PayTR merchant_oid: alphanumeric, unique */
export function generateMerchantOid(): string {
  return `PW${Date.now()}${randomBytes(4).toString("hex")}`.slice(0, 64);
}
