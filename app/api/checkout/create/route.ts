import { NextRequest, NextResponse } from "next/server";
import { createPendingOrder } from "@/lib/orders";
import { encodeBasket, requestPaytrIframeToken, tryToKurus } from "@/lib/paytr";
import { isLocale, Locale } from "@/lib/i18n";
import { isDirectSalesEnabled } from "@/lib/commerce";
import { ensureInventorySeeded } from "@/lib/inventory";

export const dynamic = "force-dynamic";

function clientIp(req: NextRequest): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "127.0.0.1";
  return req.ip || "127.0.0.1";
}

export async function POST(req: NextRequest) {
  if (!isDirectSalesEnabled()) {
    return NextResponse.json({ ok: false, error: "sales_disabled" }, { status: 403 });
  }

  try {
    await ensureInventorySeeded();

    const body = await req.json();
    const locale = (isLocale(body.locale) ? body.locale : "tr") as Locale;

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
      locale,
      items: Array.isArray(body.items) ? body.items : []
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      req.nextUrl.origin;

    const okUrl =
      process.env.PAYTR_MERCHANT_OK_URL ||
      `${origin}/${locale}/checkout/success?oid=${result.order.orderNumber}`;
    const failUrl =
      process.env.PAYTR_MERCHANT_FAIL_URL ||
      `${origin}/${locale}/checkout/fail?oid=${result.order.orderNumber}`;

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
