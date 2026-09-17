import { NextRequest, NextResponse } from "next/server";
import { isLocale, Locale } from "@/lib/i18n";
import {
  changePasswordWithCode,
  getUserFromRequest,
  requestPasswordChangeCode
} from "@/lib/account";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const locale = (isLocale(String(body.locale || "")) ? body.locale : "tr") as Locale;
  const result = await requestPasswordChangeCode(user.id, locale);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const result = await changePasswordWithCode(user.id, {
    code: String(body.code || ""),
    nextPassword: String(body.nextPassword || "")
  });
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
