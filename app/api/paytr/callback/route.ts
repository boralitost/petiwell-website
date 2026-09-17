import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPaytrCallback } from "@/lib/paytr";
import { markOrderPaid } from "@/lib/orders";
import { sendPaymentFailedEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/** PayTR panel may probe the notify URL with GET. */
export async function GET() {
  return new NextResponse("OK");
}

async function readNotifyFields(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  const raw = await req.arrayBuffer();
  const requestLike = new Request(req.url, {
    method: "POST",
    headers: req.headers,
    body: raw
  });

  if (contentType.includes("multipart/form-data")) {
    const form = await requestLike.formData();
    return {
      merchantOid: String(form.get("merchant_oid") || ""),
      status: String(form.get("status") || ""),
      totalAmount: String(form.get("total_amount") || ""),
      hash: String(form.get("hash") || ""),
      raw: JSON.stringify(Object.fromEntries(form.entries()))
    };
  }

  const text = new TextDecoder().decode(raw);
  const params = new URLSearchParams(text);
  return {
    merchantOid: String(params.get("merchant_oid") || ""),
    status: String(params.get("status") || ""),
    totalAmount: String(params.get("total_amount") || ""),
    hash: String(params.get("hash") || ""),
    raw: text.slice(0, 2000)
  };
}

/**
 * PayTR server-to-server notification.
 * Respond with plain "OK" after successful processing.
 * Order becomes paid ONLY here — never from frontend redirect.
 */
export async function POST(req: NextRequest) {
  try {
    const fields = await readNotifyFields(req);
    const { merchantOid, status, totalAmount, hash } = fields;

    if (!merchantOid || !hash) {
      console.error("paytr callback missing fields");
      return new NextResponse("missing fields", { status: 400 });
    }

    if (!verifyPaytrCallback({ merchantOid, status, totalAmount, hash })) {
      console.error("paytr callback bad hash", {
        oidLen: merchantOid.length,
        status,
        amountLen: totalAmount.length
      });
      return new NextResponse("bad hash", { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { paytrMerchantOid: merchantOid },
      include: { items: true, payments: true }
    });

    if (!order) {
      console.error("paytr callback order not found", {
        oidLen: merchantOid.length
      });
      return new NextResponse("order not found", { status: 404 });
    }

    if (order.paymentStatus === "success" && order.status === "paid") {
      return new NextResponse("OK");
    }

    const expectedKurus = Math.round(Number(order.totalTry) * 100);
    if (String(expectedKurus) !== String(totalAmount)) {
      await prisma.paymentAttempt.updateMany({
        where: { merchantOid },
        data: {
          status: "failed",
          errorMessage: `amount_mismatch expected=${expectedKurus} got=${totalAmount}`,
          callbackAt: new Date(),
          rawCallback: fields.raw
        }
      });
      return new NextResponse("amount mismatch", { status: 400 });
    }

    if (status !== "success") {
      await prisma.$transaction([
        prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: "failed" }
        }),
        prisma.paymentAttempt.updateMany({
          where: { merchantOid },
          data: {
            status: "failed",
            errorMessage: status,
            callbackAt: new Date(),
            rawCallback: fields.raw
          }
        })
      ]);

      await sendPaymentFailedEmail({
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerEmail: order.customerEmail
      });

      return new NextResponse("OK");
    }

    await prisma.paymentAttempt.updateMany({
      where: { merchantOid },
      data: { rawCallback: fields.raw }
    });

    await markOrderPaid(order.id, merchantOid);
    return new NextResponse("OK");
  } catch (err) {
    console.error("paytr callback", err);
    return new NextResponse("error", { status: 500 });
  }
}
