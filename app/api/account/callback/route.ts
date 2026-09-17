import { NextRequest, NextResponse } from "next/server";
import { isLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const locale = isLocale(String(req.nextUrl.searchParams.get("locale") || ""))
    ? String(req.nextUrl.searchParams.get("locale"))
    : "tr";
  return NextResponse.redirect(new URL(`/${locale}/account/forgot`, req.nextUrl.origin));
}
