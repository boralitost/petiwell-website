import { NextRequest, NextResponse } from "next/server";
import { isPetiwellOrderNumber } from "@/lib/order-id";
import { prisma } from "@/lib/db";
import { retryPaidEmailIfNeeded, syncPaidFromPaytr } from "@/lib/orders";
import { orderToGa4Purchase } from "@/lib/ga4-mp";

export const dynamic = "force-dynamic";

const orderSelect = {
  id: true,
  orderNumber: true,
  paymentStatus: true,
  status: true,
  totalTry: true,
  currency: true,
  items: {
    select: {
      sku: true,
      productId: true,
      productName: true,
      unitPriceTry: true,
      quantity: true
    }
  }
} as const;

function paidJson(order: {
  id: string;
  orderNumber: string;
  totalTry: { toString(): string } | number | string;
  currency?: string | null;
  items: {
    sku: string;
    productId: string;
    productName: string;
    unitPriceTry: { toString(): string } | number | string;
    quantity: number;
  }[];
}) {
  const purchase = orderToGa4Purchase(order);
  return {
    ok: true as const,
    status: "paid" as const,
    transaction_id: purchase.transactionId,
    value: purchase.value,
    currency: purchase.currency,
    items: purchase.items
  };
}

/**
 * Public confirmation after PayTR redirect.
 * Marks paid only if PayTR durum-sorgu says success — never trusts the browser.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const orderNumber = String(body.oid || "").trim();
  if (!isPetiwellOrderNumber(orderNumber)) {
    return NextResponse.json({ ok: false, error: "invalid_oid" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: orderSelect
  });
  if (!order) {
    return NextResponse.json({ ok: false, error: "order_not_found" }, { status: 404 });
  }

  if (order.paymentStatus === "success") {
    await retryPaidEmailIfNeeded(order.id);
    return NextResponse.json(paidJson(order));
  }
  if (order.paymentStatus === "failed") {
    return NextResponse.json({ ok: true, status: "failed" });
  }

  const synced = await syncPaidFromPaytr(order.id);
  if (synced.ok && synced.paymentStatus === "success") {
    const fresh = await prisma.order.findUnique({
      where: { id: order.id },
      select: orderSelect
    });
    return NextResponse.json(fresh ? paidJson(fresh) : { ok: true, status: "paid" });
  }

  return NextResponse.json({
    ok: true,
    status: "pending",
    error: synced.ok ? undefined : synced.error
  });
}
