import { NextRequest, NextResponse } from "next/server";
import { isLocale, Locale } from "@/lib/i18n";
import { registerAccount } from "@/lib/account";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const locale = (isLocale(String(body.locale || "")) ? body.locale : "tr") as Locale;
    const result = await registerAccount({
      email: String(body.email || ""),
      password: String(body.password || ""),
      name: String(body.name || ""),
      locale
    });
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
