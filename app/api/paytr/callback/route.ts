import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPaytrCallback } from "@/lib/paytr";
import { decrementStock, ensureInventorySeeded } from "@/lib/inventory";
import {
  sendOrderPaidEmail,
  sendPaymentFailedEmail
} from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * PayTR server-to-server notification.
 * Respond with plain "OK" after successful processing.
 * Order becomes paid ONLY here — never from frontend redirect.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const merchantOid = String(form.get("merchant_oid") || "");
    const status = String(form.get("status") || "");
    const totalAmount = String(form.get("total_amount") || "");
    const hash = String(form.get("hash") || "");

    if (!merchantOid || !hash) {
      return new NextResponse("missing fields", { status: 400 });
    }

    if (!verifyPaytrCallback({ merchantOid, status, totalAmount, hash })) {
      return new NextResponse("bad hash", { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { paytrMerchantOid: merchantOid },
      include: { items: true, payments: true }
    });

    if (!order) {
      return new NextResponse("order not found", { status: 404 });
    }

    // Idempotent: already paid
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
          rawCallback: JSON.stringify(Object.fromEntries(form.entries()))
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
            rawCallback: JSON.stringify(Object.fromEntries(form.entries()))
          }
        })
      ]);

      void sendPaymentFailedEmail({
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerEmail: order.customerEmail
      });

      return new NextResponse("OK");
    }

    await ensureInventorySeeded();

    await prisma.$transaction(async (tx) => {
      const fresh = await tx.order.findUnique({ where: { id: order.id } });
      if (!fresh || fresh.paymentStatus === "success") return;

      for (const item of order.items) {
        await decrementStock(item.productId, item.quantity, tx);
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "paid",
          paymentStatus: "success"
        }
      });

      await tx.paymentAttempt.updateMany({
        where: { merchantOid },
        data: {
          status: "success",
          callbackAt: new Date(),
          rawCallback: JSON.stringify(Object.fromEntries(form.entries()))
        }
      });
    });

    void sendOrderPaidEmail({
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      shippingAddress: order.shippingAddress,
      city: order.city,
      subtotalTry: Number(order.subtotalTry),
      shippingTry: Number(order.shippingTry),
      totalTry: Number(order.totalTry),
      items: order.items.map((i) => ({
        productName: i.productName,
        quantity: i.quantity,
        unitPriceTry: Number(i.unitPriceTry),
        lineTotalTry: Number(i.lineTotalTry)
      }))
    });

    return new NextResponse("OK");
  } catch (err) {
    console.error("paytr callback", err);
    return new NextResponse("error", { status: 500 });
  }
}
