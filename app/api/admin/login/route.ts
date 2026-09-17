import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  adminConfigured,
  createAdminSessionToken,
  loginDatabaseAdmin,
  logoutDatabaseAdmin,
  verifyLegacyAdminLogin
} from "@/lib/admin-auth";
import { isSameOriginRequest } from "@/lib/ambassador-security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ ok: false, error: "invalid_origin" }, { status: 403 });
  }
  if (!adminConfigured()) {
    return NextResponse.json({ ok: false, error: "admin_not_configured" }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "");
  const password = String(body.password || "");
  const totpCode = String(body.totpCode || "");
  let token = "";
  if (email && process.env.ADMIN_DATABASE_AUTH_ENABLED === "true") {
    const result = await loginDatabaseAdmin({ email, password, totpCode });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 401 }
      );
    }
    token = result.token;
  } else if (verifyLegacyAdminLogin(password, totpCode)) {
    token = createAdminSessionToken();
  } else {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });
  return res;
}

export async function DELETE(req: NextRequest) {
  await logoutDatabaseAdmin(req.cookies.get(ADMIN_COOKIE)?.value);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
