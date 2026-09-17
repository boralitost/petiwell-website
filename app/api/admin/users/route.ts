import { NextRequest, NextResponse } from "next/server";
import type { AdminRole } from "@prisma/client";
import {
  createTotpSecret,
  requireAdminRole
} from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import {
  hashPassword,
  isValidEmail,
  isValidPassword,
  normalizeEmail
} from "@/lib/account-auth";
import {
  encryptSensitive,
  isSameOriginRequest
} from "@/lib/ambassador-security";

export const dynamic = "force-dynamic";

const ROLES: AdminRole[] = [
  "SUPER_ADMIN",
  "OPERATIONS",
  "FINANCE",
  "CONTENT_REVIEW"
];

export async function GET() {
  if (!(await requireAdminRole(["SUPER_ADMIN"]))) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const users = await prisma.adminUser.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      role: true,
      active: true,
      totpEnabledAt: true,
      lastLoginAt: true,
      createdAt: true
    }
  });
  return NextResponse.json({ ok: true, users });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdminRole(["SUPER_ADMIN"]))) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ ok: false, error: "invalid_origin" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(String(body.email || ""));
  const password = String(body.password || "");
  const role = String(body.role || "") as AdminRole;
  if (!isValidEmail(email) || !isValidPassword(password) || !ROLES.includes(role)) {
    return NextResponse.json({ ok: false, error: "invalid_fields" }, { status: 400 });
  }
  const secret = createTotpSecret();
  const user = await prisma.adminUser.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      role,
      totpSecretEncrypted: encryptSensitive(secret),
      totpEnabledAt: new Date()
    },
    select: { id: true, email: true, role: true }
  });
  const issuer = encodeURIComponent("Petiwell Admin");
  const label = encodeURIComponent(`Petiwell Admin:${email}`);
  return NextResponse.json({
    ok: true,
    user,
    totpSecret: secret,
    otpauthUrl: `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&digits=6&period=30`
  });
}

export async function PATCH(req: NextRequest) {
  const principal = await requireAdminRole(["SUPER_ADMIN"]);
  if (!principal) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ ok: false, error: "invalid_origin" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  const role = body.role ? (String(body.role) as AdminRole) : null;
  if (!id || (role && !ROLES.includes(role))) {
    return NextResponse.json({ ok: false, error: "invalid_fields" }, { status: 400 });
  }
  if (id === principal.id && body.active === false) {
    return NextResponse.json(
      { ok: false, error: "cannot_disable_self" },
      { status: 409 }
    );
  }
  await prisma.adminUser.update({
    where: { id },
    data: {
      ...(role ? { role } : {}),
      ...(typeof body.active === "boolean" ? { active: body.active } : {})
    }
  });
  return NextResponse.json({ ok: true });
}
