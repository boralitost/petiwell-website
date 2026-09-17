import { NextRequest, NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { OrderStatus } from "@prisma/client";
import {
  sendOrderCancelledEmail,
  sendOrderDeliveredEmail,
  sendOrderPreparingEmail,
  sendOrderRefundedEmail,
  sendOrderShippedEmail
} from "@/lib/email";
import { incrementStock } from "@/lib/inventory";
import { retryPaidEmailIfNeeded, syncPaidFromPaytr } from "@/lib/orders";
import { refundPaytrOrder } from "@/lib/paytr";
import {
  canTransition,
  customerEmailOnStatus,
  isOrderStatus,
  isUsableTrackingNumber,
  needsPaytrRefund,
  normalizeTrackingNumber,
  requiresTrackingNumber,
  shouldRestoreStock,
  type CustomerEmailKind,
  type OrderStatusName,
  type PaymentStatusName
} from "@/lib/order-status";
import { syncCommissionForOrderStatus } from "@/lib/ambassador-commission";
import { refundOrderAmount } from "@/lib/refunds";
import { isSameOriginRequest } from "@/lib/ambassador-security";

export const dynamic = "force-dynamic";

function emailPayload(order: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  city: string;
  subtotalTry: { toString(): string } | number;
  shippingTry: { toString(): string } | number;
  discountTry?: { toString(): string } | number;
  totalTry: { toString(): string } | number;
  promoCode?: string | null;
  trackingNumber?: string | null;
  items: {
    productName: string;
    quantity: number;
    unitPriceTry: { toString(): string } | number;
    lineTotalTry: { toString(): string } | number;
  }[];
}) {
  return {
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    shippingAddress: order.shippingAddress,
    city: order.city,
    subtotalTry: Number(order.subtotalTry),
    shippingTry: Number(order.shippingTry),
    discountTry: Number(order.discountTry || 0),
    totalTry: Number(order.totalTry),
    promoCode: order.promoCode,
    trackingNumber: order.trackingNumber,
    items: order.items.map((i) => ({
      productName: i.productName,
      quantity: i.quantity,
      unitPriceTry: Number(i.unitPriceTry),
      lineTotalTry: Number(i.lineTotalTry)
    }))
  };
}

async function sendStatusEmail(
  kind: CustomerEmailKind,
  order: Parameters<typeof emailPayload>[0]
) {
  const payload = emailPayload(order);
  switch (kind) {
    case "preparing":
      return sendOrderPreparingEmail(payload);
    case "shipped":
      return sendOrderShippedEmail(payload);
    case "delivered":
      return sendOrderDeliveredEmail(payload);
    case "cancelled":
      return sendOrderCancelledEmail(payload);
    case "refunded":
      return sendOrderRefundedEmail(payload);
  }
}

export async function PATCH(req: NextRequest) {
  const principal = await requireAdminRole([
    "SUPER_ADMIN",
    "OPERATIONS",
    "FINANCE"
  ]);
  if (!principal) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ ok: false, error: "invalid_origin" }, { status: 403 });
  }

  const body = await req.json();
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });

  if (body.action === "partial_refund") {
    if (!["SUPER_ADMIN", "FINANCE"].includes(principal.role)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    const result = await refundOrderAmount({
      orderId: id,
      amountTry: Number(body.amountTry),
      productRefundTry: Number(body.productRefundTry),
      reason: String(body.reason || ""),
      idempotencyKey: String(body.idempotencyKey || "")
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  if (body.action === "sync_paytr") {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true }
    });
    if (!order?.paytrMerchantOid) {
      return NextResponse.json({ ok: false, error: "missing_oid" }, { status: 400 });
    }
    const synced = await syncPaidFromPaytr(order.id);
    if (!synced.ok) {
      return NextResponse.json({ ok: false, error: synced.error }, { status: 502 });
    }
    const fresh = await prisma.order.findUnique({
      where: { id },
      include: { items: true, payments: true }
    });
    return NextResponse.json({ ok: true, order: fresh });
  }

  const existing = await prisma.order.findUnique({
    where: { id },
    include: { items: true }
  });
  if (!existing) {
    return NextResponse.json({ ok: false, error: "order_not_found" }, { status: 404 });
  }

  if (body.action === "send_paid_email") {
    if (existing.paymentStatus !== "success") {
      return NextResponse.json({ ok: false, error: "payment_not_success" }, { status: 409 });
    }
    if (existing.paidEmailSentAt) {
      return NextResponse.json({ ok: true, skipped: true });
    }
    const email = await retryPaidEmailIfNeeded(existing.id);
    if (!email.ok) {
      return NextResponse.json(
        { ok: false, error: email.error || "email_failed" },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "send_shipped_email") {
    if (existing.status !== "shipped") {
      return NextResponse.json({ ok: false, error: "not_shipped" }, { status: 409 });
    }
    if (!isUsableTrackingNumber(existing.trackingNumber)) {
      return NextResponse.json({ ok: false, error: "tracking_required" }, { status: 400 });
    }
    const email = await sendOrderShippedEmail(emailPayload(existing));
    if (!email.ok) {
      return NextResponse.json(
        { ok: false, error: email.error || "email_failed" },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  const data: {
    status?: OrderStatus;
    trackingNumber?: string;
    paymentStatus?: "refunded";
    refundedTry?: number;
    productRefundedTry?: number;
  } = {};

  if (typeof body.trackingNumber === "string") {
    data.trackingNumber = normalizeTrackingNumber(body.trackingNumber);
  }

  if (body.status) {
    if (!isOrderStatus(String(body.status))) {
      return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 400 });
    }
    const nextStatus = body.status as OrderStatusName;
    const from = existing.status as OrderStatusName;
    if (!canTransition(from, nextStatus)) {
      return NextResponse.json(
        { ok: false, error: "invalid_transition" },
        { status: 409 }
      );
    }
    const tracking =
      data.trackingNumber ?? existing.trackingNumber ?? "";
    if (requiresTrackingNumber(nextStatus) && !isUsableTrackingNumber(tracking)) {
      return NextResponse.json(
        { ok: false, error: "tracking_required" },
        { status: 400 }
      );
    }
    data.status = nextStatus as OrderStatus;
  }

  if (
    data.status &&
    needsPaytrRefund(
      data.status as OrderStatusName,
      existing.paymentStatus as PaymentStatusName
    )
  ) {
    if (!existing.paytrMerchantOid) {
      return NextResponse.json({ ok: false, error: "missing_oid" }, { status: 400 });
    }
    const remainingRefund = Math.max(
      0,
      Number(existing.totalTry) - Number(existing.refundedTry)
    );
    if (remainingRefund > 0) {
      const refund = await refundPaytrOrder(
        existing.paytrMerchantOid,
        remainingRefund
      );
      if (!refund.ok) {
        return NextResponse.json(
          { ok: false, error: refund.error || "paytr_refund_failed" },
          { status: 502 }
        );
      }
    }
    data.paymentStatus = "refunded";
    data.refundedTry = Number(existing.totalTry);
    data.productRefundedTry = Number(existing.productTotalAfterDiscountTry);
  }

  const trackingOnly =
    !data.status && typeof data.trackingNumber === "string";
  if (trackingOnly && existing.status !== "shipped") {
    return NextResponse.json(
      { ok: false, error: "tracking_only_when_shipped" },
      { status: 409 }
    );
  }
  if (trackingOnly && !isUsableTrackingNumber(data.trackingNumber)) {
    return NextResponse.json({ ok: false, error: "tracking_required" }, { status: 400 });
  }

  if (!data.status && !trackingOnly) {
    return NextResponse.json({ ok: false, error: "no_changes" }, { status: 400 });
  }

  const order = await prisma.order.update({
    where: { id },
    data,
    include: { items: true }
  });
  if (data.status) {
    await syncCommissionForOrderStatus(order.id, data.status);
  }

  if (
    data.status &&
    shouldRestoreStock(
      existing.status as OrderStatusName,
      data.status as OrderStatusName,
      existing.paymentStatus as PaymentStatusName
    )
  ) {
    await prisma.$transaction(async (tx) => {
      for (const item of existing.items) {
        await incrementStock(item.productId, item.quantity, tx);
      }
    });
  }

  let emailError: string | undefined;
  if (data.status) {
    const kind = customerEmailOnStatus(
      existing.status as OrderStatusName,
      data.status as OrderStatusName,
      existing.paymentStatus as PaymentStatusName
    );
    if (kind) {
      const email = await sendStatusEmail(kind, order);
      if (!email.ok) emailError = email.error || "email_failed";
    }
  } else if (trackingOnly) {
    const email = await sendOrderShippedEmail(emailPayload(order));
    if (!email.ok) emailError = email.error || "email_failed";
  }

  if (emailError) {
    return NextResponse.json(
      { ok: false, error: emailError, persisted: true },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, order });
}
