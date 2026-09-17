import { NextRequest, NextResponse } from "next/server";
import { createPendingOrder } from "@/lib/orders";
import { encodeBasket, requestPaytrIframeToken, tryToKurus } from "@/lib/paytr";
import { isLocale, Locale } from "@/lib/i18n";
import { isDirectSalesEnabled } from "@/lib/commerce";
import { prisma } from "@/lib/db";
import { ensureInventorySeeded } from "@/lib/inventory";
import { getUserFromRequest } from "@/lib/account";
import { referralIdFromRequest } from "@/lib/ambassador-referral";

export const dynamic = "force-dynamic";

function clientIp(req: NextRequest): string {
  const xf = req.headers.get("x-forwarded-for");
  const candidates = [
    ...(xf ? xf.split(",").map((p) => p.trim()) : []),
    req.headers.get("x-real-ip") || ""
  ].filter(Boolean);
  const ipv4 = candidates.find((ip) => /^\d{1,3}(\.\d{1,3}){3}$/.test(ip));
  return ipv4 || candidates[0] || "127.0.0.1";
}

export async function POST(req: NextRequest) {
  if (!isDirectSalesEnabled()) {
    return NextResponse.json({ ok: false, error: "sales_disabled" }, { status: 403 });
  }

  try {
    await ensureInventorySeeded();

    const body = await req.json();
    const locale = (isLocale(body.locale) ? body.locale : "tr") as Locale;
    const user = await getUserFromRequest(req);

    const result = await createPendingOrder({
      customerName: String(body.customerName || ""),
      customerEmail: String(body.customerEmail || ""),
      customerPhone: String(body.customerPhone || ""),
      shippingAddress: String(body.shippingAddress || ""),
      billingAddress: String(body.billingAddress || body.shippingAddress || ""),
      city: String(body.city || ""),
      district: String(body.district || ""),
      postalCode: String(body.postalCode || ""),
      notes: String(body.notes || ""),
      distanceSalesAccepted: Boolean(body.distanceSalesAccepted),
      preInfoAccepted: Boolean(body.preInfoAccepted),
      privacyAccepted: Boolean(body.privacyAccepted),
      locale,
      items: Array.isArray(body.items) ? body.items : [],
      promoCode: String(body.promoCode || ""),
      userId: user?.id || null,
      ambassadorReferralId: referralIdFromRequest(req)
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    const origin = req.nextUrl.origin.replace(/\/$/, "");
    const orderNumber = result.order.orderNumber;
    const siteOrigin = (
      process.env.NEXT_PUBLIC_SITE_URL || origin
    ).replace(/\/$/, "");
    const usePreviewUrls = process.env.VERCEL_ENV === "preview";
    const okBase = usePreviewUrls
      ? `${origin}/${locale}/checkout/success`
      : process.env.PAYTR_MERCHANT_OK_URL ||
        `${siteOrigin}/${locale}/checkout/success`;
    const failBase = usePreviewUrls
      ? `${origin}/${locale}/checkout/fail`
      : process.env.PAYTR_MERCHANT_FAIL_URL ||
        `${siteOrigin}/${locale}/checkout/fail`;

    const withOid = (base: string) => {
      try {
        const url = new URL(base);
        url.searchParams.set("oid", orderNumber);
        return url.toString();
      } catch {
        const join = base.includes("?") ? "&" : "?";
        return `${base}${join}oid=${encodeURIComponent(orderNumber)}`;
      }
    };

    const okUrl = withOid(okBase);
    const failUrl = withOid(failBase);

    const basket = encodeBasket(
      result.quote.lines.map((l) => ({
        name: l.name,
        priceTry: l.unitPriceTry,
        quantity: l.quantity
      }))
    );

    const tokenRes = await requestPaytrIframeToken({
      email: result.order.customerEmail,
      paymentAmountKurus: tryToKurus(Number(result.order.totalTry)),
      merchantOid: result.order.paytrMerchantOid!,
      userName: result.order.customerName,
      userAddress: `${result.order.shippingAddress}, ${result.order.city}`,
      userPhone: result.order.customerPhone,
      userBasket: basket,
      userIp: clientIp(req),
      merchantOkUrl: okUrl,
      merchantFailUrl: failUrl,
      lang: locale === "en" ? "en" : "tr"
    });

    if (!tokenRes.ok) {
      if (result.quote.totals.promoCode) {
        await prisma.promoCode.updateMany({
          where: {
            code: result.quote.totals.promoCode,
            usedCount: { gt: 0 }
          },
          data: { usedCount: { decrement: 1 } }
        });
      }
      return NextResponse.json(
        {
          ok: false,
          error: tokenRes.error,
          orderNumber: result.order.orderNumber,
          pendingWithoutPaytr: true
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      orderNumber: result.order.orderNumber,
      merchantOid: result.order.paytrMerchantOid,
      token: tokenRes.token,
      totals: result.quote.totals
    });
  } catch (err) {
    console.error("checkout/create", err);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
