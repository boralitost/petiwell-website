import { NextRequest } from "next/server";
import { Locale } from "@/lib/i18n";
import { prisma } from "@/lib/db";
import { sendOtpEmail } from "@/lib/email";
import {
  LOGIN_COOLDOWN_MS,
  LOGIN_MAX_PER_HOUR,
  OTP_TTL_MS,
  SESSION_TTL_MS,
  createOpaqueToken,
  createOtpCode,
  hashOtp,
  hashPassword,
  hashToken,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
  type OtpPurpose,
  readSessionTokenFromCookies,
  readSessionTokenFromRequest,
  verifyPassword
} from "@/lib/account-auth";
import { isValidTrLocation } from "@/lib/tr-locations";

export type AccountUser = {
  id: string;
  email: string;
  name: string;
  phone: string;
  address: {
    id: string;
    fullName: string;
    phone: string;
    address: string;
    city: string;
    district: string;
    postalCode: string;
  } | null;
};

function toAccountUser(user: {
  id: string;
  email: string;
  name: string;
  phone: string;
  addresses: {
    id: string;
    fullName: string;
    phone: string;
    address: string;
    city: string;
    district: string;
    postalCode: string;
    isDefault: boolean;
  }[];
}): AccountUser {
  const address =
    user.addresses.find((row) => row.isDefault) || user.addresses[0] || null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    address: address
      ? {
          id: address.id,
          fullName: address.fullName,
          phone: address.phone,
          address: address.address,
          city: address.city,
          district: address.district,
          postalCode: address.postalCode
        }
      : null
  };
}

async function loadUserById(id: string): Promise<AccountUser | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { addresses: true }
  });
  return user ? toAccountUser(user) : null;
}

export async function getCurrentUser(): Promise<AccountUser | null> {
  return getUserFromSessionToken(await readSessionTokenFromCookies());
}

export async function getUserFromRequest(
  req: NextRequest
): Promise<AccountUser | null> {
  return getUserFromSessionToken(readSessionTokenFromRequest(req));
}

export async function getUserFromSessionToken(
  raw: string
): Promise<AccountUser | null> {
  if (!raw) return null;
  const session = await prisma.userSession.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: { include: { addresses: true } } }
  });
  if (!session || session.expiresAt.getTime() <= Date.now()) {
    return null;
  }
  return toAccountUser(session.user);
}

async function issueSession(userId: string): Promise<string> {
  const sessionToken = createOpaqueToken();
  await prisma.userSession.create({
    data: {
      userId,
      tokenHash: hashToken(sessionToken),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS)
    }
  });
  return sessionToken;
}

async function attachOrders(userId: string, email: string) {
  await prisma.order.updateMany({
    where: { customerEmail: email, userId: null },
    data: { userId }
  });
}

async function sendAccountOtp(input: {
  email: string;
  purpose: OtpPurpose;
  locale: Locale;
  userId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = normalizeEmail(input.email);
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await prisma.loginToken.count({
    where: { email, purpose: input.purpose, createdAt: { gt: hourAgo } }
  });
  if (recentCount >= LOGIN_MAX_PER_HOUR) {
    return { ok: true };
  }
  const last = await prisma.loginToken.findFirst({
    where: { email, purpose: input.purpose },
    orderBy: { createdAt: "desc" }
  });
  if (last && Date.now() - last.createdAt.getTime() < LOGIN_COOLDOWN_MS) {
    return { ok: true };
  }
  const code = createOtpCode();
  await prisma.loginToken.create({
    data: {
      email,
      userId: input.userId || null,
      purpose: input.purpose,
      tokenHash: hashOtp(email, input.purpose, code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS)
    }
  });
  await sendOtpEmail({
    to: email,
    code,
    purpose: input.purpose,
    locale: input.locale
  });
  return { ok: true };
}

async function consumeAccountOtp(input: {
  email: string;
  purpose: OtpPurpose;
  code: string;
}) {
  const email = normalizeEmail(input.email);
  const row = await prisma.loginToken.findUnique({
    where: { tokenHash: hashOtp(email, input.purpose, input.code) }
  });
  if (
    !row ||
    row.email !== email ||
    row.purpose !== input.purpose ||
    row.usedAt ||
    row.expiresAt.getTime() <= Date.now()
  ) {
    return null;
  }
  await prisma.loginToken.update({
    where: { id: row.id },
    data: { usedAt: new Date() }
  });
  return row;
}

export async function registerAccount(input: {
  email: string;
  password: string;
  name?: string;
  locale: Locale;
}): Promise<
  | { ok: true; needsVerification: true; email: string }
  | { ok: false; error: string }
> {
  if (!isValidEmail(input.email)) {
    return { ok: false, error: "invalid_email" };
  }
  if (!isValidPassword(input.password)) {
    return { ok: false, error: "weak_password" };
  }
  const email = normalizeEmail(input.email);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.emailVerifiedAt) {
    return { ok: false, error: "email_taken" };
  }
  const passwordHash = await hashPassword(input.password);
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { name: (input.name || existing.name).trim(), passwordHash }
      })
    : await prisma.user.create({
        data: {
          email,
          name: (input.name || "").trim(),
          passwordHash
        }
      });
  await sendAccountOtp({
    email,
    purpose: "verify_email",
    locale: input.locale,
    userId: user.id
  });
  return { ok: true, needsVerification: true, email };
}

export async function loginWithPassword(input: {
  email: string;
  password: string;
  locale: Locale;
}): Promise<
  | { ok: true; sessionToken: string }
  | { ok: false; error: string; email?: string }
> {
  if (!isValidEmail(input.email) || !input.password) {
    return { ok: false, error: "invalid_credentials" };
  }
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    return { ok: false, error: "invalid_credentials" };
  }
  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    return { ok: false, error: "invalid_credentials" };
  }
  if (!user.emailVerifiedAt) {
    await sendAccountOtp({
      email,
      purpose: "verify_email",
      locale: input.locale,
      userId: user.id
    });
    return { ok: false, error: "email_unverified", email };
  }
  await attachOrders(user.id, email);
  return { ok: true, sessionToken: await issueSession(user.id) };
}

export async function requestEmailVerification(input: {
  email: string;
  locale: Locale;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isValidEmail(input.email)) {
    return { ok: false, error: "invalid_email" };
  }
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.emailVerifiedAt) {
    return { ok: true };
  }
  return sendAccountOtp({
    email,
    purpose: "verify_email",
    locale: input.locale,
    userId: user.id
  });
}

export async function verifyEmailCode(input: {
  email: string;
  code: string;
}): Promise<
  | { ok: true; sessionToken: string }
  | { ok: false; error: string }
> {
  const email = normalizeEmail(input.email);
  const row = await consumeAccountOtp({
    email,
    purpose: "verify_email",
    code: input.code
  });
  if (!row) {
    return { ok: false, error: "invalid_code" };
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { ok: false, error: "invalid_code" };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: user.emailVerifiedAt || new Date() }
  });
  await attachOrders(user.id, email);
  return { ok: true, sessionToken: await issueSession(user.id) };
}

export async function requestPasswordReset(input: {
  email: string;
  locale: Locale;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isValidEmail(input.email)) {
    return { ok: false, error: "invalid_email" };
  }
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { ok: true };
  }
  return sendAccountOtp({
    email,
    purpose: "reset_password",
    locale: input.locale,
    userId: user.id
  });
}

export async function resetPasswordWithCode(input: {
  email: string;
  code: string;
  password: string;
}): Promise<
  | { ok: true; sessionToken: string }
  | { ok: false; error: string }
> {
  if (!isValidPassword(input.password)) {
    return { ok: false, error: "weak_password" };
  }
  const email = normalizeEmail(input.email);
  const row = await consumeAccountOtp({
    email,
    purpose: "reset_password",
    code: input.code
  });
  if (!row) {
    return { ok: false, error: "invalid_code" };
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { ok: false, error: "invalid_code" };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(input.password),
      emailVerifiedAt: user.emailVerifiedAt || new Date()
    }
  });
  await attachOrders(user.id, email);
  return { ok: true, sessionToken: await issueSession(user.id) };
}

export async function requestPasswordChangeCode(
  userId: string,
  locale: Locale
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { ok: false, error: "unauthorized" };
  }
  return sendAccountOtp({
    email: user.email,
    purpose: "change_password",
    locale,
    userId: user.id
  });
}

export async function changePasswordWithCode(
  userId: string,
  input: { code: string; nextPassword: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isValidPassword(input.nextPassword)) {
    return { ok: false, error: "weak_password" };
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { ok: false, error: "unauthorized" };
  }
  const row = await consumeAccountOtp({
    email: user.email,
    purpose: "change_password",
    code: input.code
  });
  if (!row) {
    return { ok: false, error: "invalid_code" };
  }
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(input.nextPassword) }
  });
  return { ok: true };
}

export async function revokeSession(rawToken: string) {
  if (!rawToken) return;
  await prisma.userSession.deleteMany({
    where: { tokenHash: hashToken(rawToken) }
  });
}

export async function updateAccountProfile(
  userId: string,
  input: { name: string; phone: string }
) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name.trim(),
      phone: input.phone.trim()
    }
  });
  return loadUserById(userId);
}

export async function upsertDefaultAddress(
  userId: string,
  input: {
    fullName: string;
    phone: string;
    address: string;
    city: string;
    district?: string;
    postalCode?: string;
  }
) {
  const city = input.city.trim();
  const district = (input.district ?? "").trim();
  if ((city || district) && !isValidTrLocation(city, district)) {
    throw new Error("invalid_location");
  }
  const existing = await prisma.userAddress.findFirst({
    where: { userId, isDefault: true }
  });
  const data = {
    fullName: input.fullName.trim(),
    phone: input.phone.trim(),
    address: input.address.trim(),
    city,
    district,
    postalCode: (input.postalCode ?? "").trim(),
    isDefault: true
  };
  if (existing) {
    await prisma.userAddress.update({ where: { id: existing.id }, data });
  } else {
    await prisma.userAddress.create({ data: { userId, ...data } });
  }
  return loadUserById(userId);
}

export async function closeAccount(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  await prisma.$transaction([
    prisma.userSession.deleteMany({ where: { userId } }),
    prisma.loginToken.deleteMany({
      where: { OR: [{ userId }, { email: user.email }] }
    }),
    prisma.userAddress.deleteMany({ where: { userId } }),
    prisma.order.updateMany({ where: { userId }, data: { userId: null } }),
    prisma.user.delete({ where: { id: userId } })
  ]);
}

export async function listAccountOrders(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { items: true }
  });
}
