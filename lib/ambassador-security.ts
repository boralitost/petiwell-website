import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual
} from "crypto";

const PHONE_RE = /^5\d{9}$/;
const IBAN_RE = /^TR\d{24}$/;

export function normalizeTrPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  return digits;
}

export function isValidTrPhone(raw: string): boolean {
  return PHONE_RE.test(normalizeTrPhone(raw));
}

export function normalizeSocialHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").slice(0, 80);
}

export function isAdultOn(birthDate: Date, now: Date = new Date()): boolean {
  if (Number.isNaN(birthDate.getTime()) || birthDate > now) return false;
  const cutoff = new Date(
    Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate())
  );
  return birthDate <= cutoff;
}

export function isValidTckn(raw: string): boolean {
  if (!/^[1-9]\d{10}$/.test(raw)) return false;
  const digits = raw.split("").map(Number);
  const odd = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const even = digits[1] + digits[3] + digits[5] + digits[7];
  const tenth = (odd * 7 - even) % 10;
  const eleventh = digits.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10;
  return tenth === digits[9] && eleventh === digits[10];
}

export function normalizeIban(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

export function isValidTrIban(raw: string): boolean {
  const iban = normalizeIban(raw);
  if (!IBAN_RE.test(iban)) return false;
  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
  let remainder = 0;
  for (const char of rearranged) {
    const numeric = /\d/.test(char) ? char : String(char.charCodeAt(0) - 55);
    for (const digit of numeric) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

function encryptionKey(): Buffer {
  const encoded = (process.env.AMBASSADOR_DATA_ENCRYPTION_KEY || "").trim();
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new Error("ambassador_encryption_not_configured");
  }
  return key;
}

export function encryptSensitive(raw: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(raw, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptSensitive(payload: string): string {
  const [version, ivRaw, tagRaw, encryptedRaw] = payload.split(".");
  if (version !== "v1" || !ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("invalid_encrypted_payload");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivRaw, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64")),
    decipher.final()
  ]).toString("utf8");
}

export function hashPrivateValue(raw: string): string {
  const configured =
    process.env.AMBASSADOR_HASH_PEPPER || process.env.ADMIN_SESSION_SECRET || "";
  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error("ambassador_hash_pepper_not_configured");
  }
  const pepper = configured || "development-only";
  return createHash("sha256").update(`${pepper}:${raw}`).digest("hex");
}

export function safeTokenEquals(raw: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashPrivateValue(raw));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function maskedLast4(raw: string): string {
  return raw.replace(/\D/g, "").slice(-4);
}

export function isSameOriginRequest(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  try {
    const expected = new URL(
      process.env.NEXT_PUBLIC_SITE_URL || "https://petiwell.com"
    ).origin;
    const requestOrigin = new URL(req.url).origin;
    const received = new URL(origin).origin;
    return received === expected || received === requestOrigin;
  } catch {
    return false;
  }
}
