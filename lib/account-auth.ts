import { createHash, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

const scrypt = promisify(scryptCb);

export const USER_SESSION_COOKIE = "petiwell_user_session";
export const LOGIN_TOKEN_TTL_MS = 20 * 60 * 1000;
export const OTP_TTL_MS = 10 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const LOGIN_COOLDOWN_MS = 60 * 1000;
export const LOGIN_MAX_PER_HOUR = 5;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(raw: string): boolean {
  const email = normalizeEmail(raw);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 160;
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function createOpaqueToken(): string {
  return randomBytes(32).toString("hex");
}

export type OtpPurpose =
  | "verify_email"
  | "reset_password"
  | "change_password"
  | "ambassador_verify_email";

export function createOtpCode(): string {
  return String(randomInt(100000, 1000000));
}

export function hashOtp(email: string, purpose: OtpPurpose, code: string): string {
  return hashToken(`${purpose}:${normalizeEmail(email)}:${code.trim()}`);
}

export function isValidPassword(raw: string): boolean {
  return typeof raw === "string" && raw.length >= 8 && raw.length <= 128;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [algo, saltHex, hashHex] = (stored || "").split("$");
  if (algo !== "scrypt" || !saltHex || !hashHex) return false;
  const key = (await scrypt(password, Buffer.from(saltHex, "hex"), 64)) as Buffer;
  const expected = Buffer.from(hashHex, "hex");
  if (key.length !== expected.length) return false;
  return timingSafeEqual(key, expected);
}

export function readSessionTokenFromRequest(req: NextRequest): string {
  return req.cookies.get(USER_SESSION_COOKIE)?.value || "";
}

export async function readSessionTokenFromCookies(): Promise<string> {
  return (await cookies()).get(USER_SESSION_COOKIE)?.value || "";
}

export function sessionCookieOptions(maxAgeSec: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSec
  };
}
