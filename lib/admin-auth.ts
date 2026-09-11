import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "petiwell_admin_session";

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_SESSION_SECRET);
}

function sign(value: string): string {
  const secret = process.env.ADMIN_SESSION_SECRET || "dev";
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function createAdminSessionToken(): string {
  const exp = Date.now() + 1000 * 60 * 60 * 12;
  const payload = `ok.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [flag, expStr, sig] = parts;
  const payload = `${flag}.${expStr}`;
  const expected = sign(payload);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }
  if (flag !== "ok") return false;
  const exp = Number(expStr);
  return Number.isFinite(exp) && Date.now() < exp;
}

export function isAdminAuthenticated(): boolean {
  const token = cookies().get(COOKIE)?.value;
  return verifyAdminSessionToken(token);
}

export { COOKIE as ADMIN_COOKIE };
