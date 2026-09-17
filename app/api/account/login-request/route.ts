import { NextRequest, NextResponse } from "next/server";
import { isLocale, Locale } from "@/lib/i18n";
import { requestPasswordReset } from "@/lib/account";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const locale = (isLocale(String(body.locale || "")) ? body.locale : "tr") as Locale;
    const result = await requestPasswordReset({
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
