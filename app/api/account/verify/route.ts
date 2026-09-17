import { NextRequest, NextResponse } from "next/server";
import { isLocale, Locale } from "@/lib/i18n";
import { requestEmailVerification, verifyEmailCode } from "@/lib/account";
import { withSessionCookie } from "@/lib/account-session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await verifyEmailCode({
      email: String(body.email || ""),
      code: String(body.code || "")
    });
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return withSessionCookie(NextResponse.json({ ok: true }), result.sessionToken);
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const locale = (isLocale(String(body.locale || "")) ? body.locale : "tr") as Locale;
    const result = await requestEmailVerification({
      email: String(body.email || ""),
      locale
    });
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
