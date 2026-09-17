import { NextRequest, NextResponse } from "next/server";
import { quoteCart } from "@/lib/pricing";
import { Locale, isLocale } from "@/lib/i18n";
import { referralIdFromRequest } from "@/lib/ambassador-referral";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const locale = (isLocale(body.locale) ? body.locale : "tr") as Locale;
    const items = Array.isArray(body.items) ? body.items : [];
    const quote = await quoteCart(
      items,
      locale,
      String(body.promoCode || ""),
      referralIdFromRequest(req)
    );
    if (!quote.ok) {
      return NextResponse.json({ ok: false, error: quote.error }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      lines: quote.lines,
      totals: quote.totals
    });
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
}
