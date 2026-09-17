import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { AdminRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  hashToken,
  normalizeEmail,
  verifyPassword
} from "@/lib/account-auth";
import { decryptSensitive } from "@/lib/ambassador-security";

const COOKIE = "petiwell_admin_session";
const DB_PREFIX = "db.";
const SESSION_MS = 12 * 60 * 60 * 1000;

export type AdminPrincipal = {
  id: string;
  email: string;
  role: AdminRole;
  databaseUser: boolean;
};

export function adminConfigured(): boolean {
  return Boolean(
    process.env.ADMIN_SESSION_SECRET &&
      (process.env.ADMIN_PASSWORD ||
        process.env.ADMIN_DATABASE_AUTH_ENABLED === "true")
  );
}

function sign(value: string): string {
  const secret = process.env.ADMIN_SESSION_SECRET || "dev";
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function createAdminSessionToken(): string {
  const exp = Date.now() + SESSION_MS;
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

function decodeBase32(raw: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = raw.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of clean) {
    const value = alphabet.indexOf(char);
    if (value < 0) throw new Error("invalid_totp_secret");
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

export function createTotpSecret(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes = randomBytes(20);
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5).padEnd(5, "0");
    output += alphabet[Number.parseInt(chunk, 2)];
  }
  return output;
}

export function verifyTotp(
  secret: string,
  rawCode: string,
  now = Date.now()
): boolean {
  const code = rawCode.replace(/\D/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  let key: Buffer;
  try {
    key = decodeBase32(secret);
  } catch {
    return false;
  }
  for (let window = -1; window <= 1; window += 1) {
    const counter = Math.floor(now / 30_000) + window;
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64BE(BigInt(counter));
    const digest = createHmac("sha1", key).update(buffer).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const binary =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);
    const expected = String(binary % 1_000_000).padStart(6, "0");
    if (timingSafeEqual(Buffer.from(code), Buffer.from(expected))) return true;
  }
  return false;
}

export async function createDatabaseAdminSession(adminId: string) {
  const raw = randomBytes(32).toString("base64url");
  await prisma.adminSession.create({
    data: {
      adminId,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + SESSION_MS)
    }
  });
  return `${DB_PREFIX}${raw}`;
}

export async function getAdminPrincipal(): Promise<AdminPrincipal | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  if (token.startsWith(DB_PREFIX)) {
    const session = await prisma.adminSession.findUnique({
      where: { tokenHash: hashToken(token.slice(DB_PREFIX.length)) },
      include: { admin: true }
    });
    if (
      !session ||
      !session.admin.active ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      return null;
    }
    return {
      id: session.admin.id,
      email: session.admin.email,
      role: session.admin.role,
      databaseUser: true
    };
  }
  if (!verifyAdminSessionToken(token)) return null;
  return {
    id: "env-admin",
    email: normalizeEmail(process.env.ADMIN_EMAIL || "admin@petiwell.local"),
    role: "SUPER_ADMIN",
    databaseUser: false
  };
}

export async function isAdminAuthenticated(): Promise<boolean> {
  return Boolean(await getAdminPrincipal());
}

export async function requireAdminRole(
  allowed: AdminRole[]
): Promise<AdminPrincipal | null> {
  const principal = await getAdminPrincipal();
  if (!principal || !allowed.includes(principal.role)) return null;
  return principal;
}

export async function loginDatabaseAdmin(input: {
  email: string;
  password: string;
  totpCode: string;
}) {
  const email = normalizeEmail(input.email);
  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin || !admin.active) return { ok: false as const, error: "invalid" };
  if (admin.lockedUntil && admin.lockedUntil.getTime() > Date.now()) {
    return { ok: false as const, error: "locked" };
  }
  const passwordOk = await verifyPassword(input.password, admin.passwordHash);
  let totpOk = false;
  if (admin.totpSecretEncrypted && admin.totpEnabledAt) {
    try {
      totpOk = verifyTotp(
        decryptSensitive(admin.totpSecretEncrypted),
        input.totpCode
      );
    } catch {
      totpOk = false;
    }
  }
  if (!passwordOk || !totpOk) {
    const failures = admin.failedLoginCount + 1;
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        failedLoginCount: failures >= 5 ? 0 : failures,
        lockedUntil:
          failures >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null
      }
    });
    return { ok: false as const, error: "invalid" };
  }
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date()
    }
  });
  return {
    ok: true as const,
    token: await createDatabaseAdminSession(admin.id)
  };
}

export async function logoutDatabaseAdmin(rawToken: string | undefined) {
  if (!rawToken?.startsWith(DB_PREFIX)) return;
  await prisma.adminSession.deleteMany({
    where: { tokenHash: hashToken(rawToken.slice(DB_PREFIX.length)) }
  });
}

export function verifyLegacyAdminLogin(password: string, totpCode: string) {
  const configured = process.env.ADMIN_PASSWORD || "";
  const a = Buffer.from(password);
  const b = Buffer.from(configured);
  const passwordOk = a.length === b.length && timingSafeEqual(a, b);
  const requireMfa =
    process.env.ADMIN_REQUIRE_MFA === "true" ||
    process.env.NODE_ENV === "production";
  const secret = process.env.ADMIN_TOTP_SECRET || "";
  const totpOk = !requireMfa || (Boolean(secret) && verifyTotp(secret, totpCode));
  return passwordOk && totpOk;
}

export { COOKIE as ADMIN_COOKIE };
