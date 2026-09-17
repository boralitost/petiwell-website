import { NextRequest, NextResponse } from "next/server";
import { isLocale, Locale } from "@/lib/i18n";
import { loginWithPassword } from "@/lib/account";
import { withSessionCookie } from "@/lib/account-session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const locale = (isLocale(String(body.locale || "")) ? body.locale : "tr") as Locale;
    const result = await loginWithPassword({
      email: String(body.email || ""),
      password: String(body.password || ""),
      locale
    });
    if (!result.ok) {
      const status = result.error === "email_unverified" ? 403 : 401;
      return NextResponse.json(result, { status });
    }
    return withSessionCookie(NextResponse.json({ ok: true }), result.sessionToken);
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
