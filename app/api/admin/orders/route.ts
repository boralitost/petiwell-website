import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { OrderStatus } from "@prisma/client";
import { sendOrderShippedEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await req.json();
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });

  const data: {
    status?: OrderStatus;
    trackingNumber?: string;
  } = {};

  if (body.status) data.status = body.status as OrderStatus;
  if (typeof body.trackingNumber === "string") {
    data.trackingNumber = body.trackingNumber;
  }

  const order = await prisma.order.update({
    where: { id },
    data,
    include: { items: true }
  });

  if (data.status === "shipped") {
    void sendOrderShippedEmail({
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      shippingAddress: order.shippingAddress,
      city: order.city,
      subtotalTry: Number(order.subtotalTry),
      shippingTry: Number(order.shippingTry),
      totalTry: Number(order.totalTry),
      trackingNumber: order.trackingNumber,
      items: order.items.map((i) => ({
        productName: i.productName,
        quantity: i.quantity,
        unitPriceTry: Number(i.unitPriceTry),
        lineTotalTry: Number(i.lineTotalTry)
      }))
    });
  }

  return NextResponse.json({ ok: true, order });
}
