import { NextRequest, NextResponse } from "next/server";
import {
  closeAccount,
  getUserFromRequest,
  revokeSession,
  updateAccountProfile,
  upsertDefaultAddress
} from "@/lib/account";
import {
  USER_SESSION_COOKIE,
  readSessionTokenFromRequest
} from "@/lib/account-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, user });
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  try {
    await updateAccountProfile(user.id, {
      name: String(body.name || ""),
      phone: String(body.phone || "")
    });
    const updated = await upsertDefaultAddress(user.id, {
      fullName: String(body.name || user.name),
      phone: String(body.phone || user.phone),
      address: String(body.address || user.address?.address || ""),
      city: String(body.city || user.address?.city || ""),
      district: String(body.district || user.address?.district || ""),
      postalCode: String(body.postalCode || user.address?.postalCode || "")
    });
    return NextResponse.json({ ok: true, user: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "invalid_location") {
      return NextResponse.json({ ok: false, error: "invalid_location" }, { status: 400 });
    }
    throw err;
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  await closeAccount(user.id);
  await revokeSession(readSessionTokenFromRequest(req));
  const res = NextResponse.json({ ok: true });
  res.cookies.set(USER_SESSION_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0
  });
  return res;
}
