import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { queryPaytrOrderStatus, refundPaytrOrder } from "@/lib/paytr";
import { roundTry } from "@/lib/ambassador-pricing";
import { syncCommissionForOrderStatus } from "@/lib/ambassador-commission";
import { sendOrderPartialRefundEmail } from "@/lib/email";

export function proportionalCommissionAdjustment(input: {
  originalCommissionTry: number;
  discountedProductTry: number;
  productRefundTry: number;
  existingAdjustmentsTry: number;
}) {
  if (input.discountedProductTry <= 0 || input.productRefundTry <= 0) return 0;
  const raw = roundTry(
    (input.originalCommissionTry * input.productRefundTry) /
      input.discountedProductTry
  );
  const remaining = Math.max(
    0,
    roundTry(input.originalCommissionTry + input.existingAdjustmentsTry)
  );
  return Math.min(raw, remaining);
}

export function paytrRefundReference(idempotencyKey: string) {
  return idempotencyKey.replace(/[^a-zA-Z0-9]/g, "").slice(0, 64);
}

async function finalizeSuccessfulRefund(
  attemptId: string,
  paytrResponse: string
) {
  const attempt = await prisma.refundAttempt.findUnique({
    where: { id: attemptId },
    include: { order: true }
  });
  if (!attempt) throw new Error("refund_attempt_not_found");
  if (attempt.status === "success") return { fullRefund: false };
  if (attempt.status !== "pending") throw new Error("refund_not_pending");
  const amountTry = Number(attempt.amountTry);
  const productRefundTry = Number(attempt.productRefundTry);
  const fullRefund =
    roundTry(Number(attempt.order.refundedTry) + amountTry) ===
    roundTry(Number(attempt.order.totalTry));

  await prisma.$transaction(
    async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: attempt.orderId }
      });
      const currentAttempt = await tx.refundAttempt.findUnique({
        where: { id: attempt.id }
      });
      if (!order || !currentAttempt) throw new Error("refund_attempt_not_found");
      if (currentAttempt.status === "success") return;
      if (currentAttempt.status !== "pending") throw new Error("refund_not_pending");
      await tx.order.update({
        where: { id: order.id },
        data: {
          refundedTry: { increment: amountTry },
          productRefundedTry: { increment: productRefundTry },
          ...(fullRefund
            ? { status: "refunded", paymentStatus: "refunded" }
            : {})
        }
      });
      await tx.refundAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "success",
          paytrResponse,
          completedAt: new Date()
        }
      });
      if (fullRefund) {
        await tx.paymentAttempt.updateMany({
          where: { orderId: order.id, status: "success" },
          data: { status: "refunded" }
        });
      } else if (order.ambassadorId && productRefundTry > 0) {
        const commission = await tx.ambassadorCommission.findUnique({
          where: { orderId: order.id },
          include: { adjustments: true }
        });
        if (commission && commission.status !== "CANCELLED") {
          const adjustedAlready = commission.adjustments.reduce(
            (sum, adjustment) => sum + Number(adjustment.amount),
            0
          );
          const adjustment = proportionalCommissionAdjustment({
            originalCommissionTry: Number(commission.commissionAmount),
            discountedProductTry: Number(
              commission.discountedProductAmount
            ),
            productRefundTry,
            existingAdjustmentsTry: adjustedAlready
          });
          if (adjustment > 0) {
            await tx.ambassadorCommissionAdjustment.create({
              data: {
                ambassadorId: order.ambassadorId,
                commissionId: commission.id,
                amount: -adjustment,
                reason: "PARTIAL_REFUND",
                status: "PENDING",
                note: `${attempt.reason}; ürün iadesi ${productRefundTry.toFixed(2)} TRY`
              }
            });
          }
        }
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
  if (fullRefund) {
    await syncCommissionForOrderStatus(attempt.orderId, "refunded");
  }
  await sendOrderPartialRefundEmail({
    to: attempt.order.customerEmail,
    customerName: attempt.order.customerName,
    orderNumber: attempt.order.orderNumber,
    amountTry,
    reason: attempt.reason
  }).catch(() => undefined);
  return { fullRefund };
}

export async function refundOrderAmount(input: {
  orderId: string;
  amountTry: number;
  productRefundTry: number;
  reason: string;
  idempotencyKey: string;
}) {
  const amountTry = roundTry(input.amountTry);
  const productRefundTry = roundTry(input.productRefundTry);
  const reason = input.reason.trim().slice(0, 500);
  const idempotencyKey = input.idempotencyKey.trim().slice(0, 160);
  if (
    amountTry <= 0 ||
    productRefundTry < 0 ||
    productRefundTry > amountTry ||
    reason.length < 3 ||
    idempotencyKey.length < 12
  ) {
    return { ok: false as const, error: "invalid_refund_fields" };
  }
  const existing = await prisma.refundAttempt.findUnique({
    where: { idempotencyKey }
  });
  if (existing) {
    return existing.status === "success"
      ? { ok: true as const, duplicate: true, fullRefund: false }
      : { ok: false as const, error: `refund_${existing.status}` };
  }

  const reserved = await prisma.$transaction(
    async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        include: {
          refunds: { where: { status: "pending" } }
        }
      });
      if (!order?.paytrMerchantOid || order.paymentStatus !== "success") {
        throw new Error("order_not_refundable");
      }
      if (["cancelled", "refunded"].includes(order.status)) {
        throw new Error("order_not_refundable");
      }
      const pendingTotal = order.refunds.reduce(
        (sum, refund) => sum + Number(refund.amountTry),
        0
      );
      const remaining = roundTry(
        Number(order.totalTry) - Number(order.refundedTry) - pendingTotal
      );
      const productRemaining = roundTry(
        Number(order.productTotalAfterDiscountTry) -
          Number(order.productRefundedTry)
      );
      if (amountTry > remaining || productRefundTry > productRemaining) {
        throw new Error("refund_exceeds_remaining");
      }
      const fullRefund =
        roundTry(Number(order.refundedTry) + pendingTotal + amountTry) ===
        roundTry(Number(order.totalTry));
      if (fullRefund && productRefundTry < productRemaining) {
        throw new Error("full_refund_requires_product_total");
      }
      const attempt = await tx.refundAttempt.create({
        data: {
          orderId: order.id,
          idempotencyKey,
          amountTry,
          productRefundTry,
          reason,
          status: "pending"
        }
      });
      return {
        attempt,
        merchantOid: order.paytrMerchantOid,
        fullRefund,
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        orderNumber: order.orderNumber
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  ).catch((error) => ({
    error: error instanceof Error ? error.message : "refund_reservation_failed"
  }));
  if ("error" in reserved) {
    return { ok: false as const, error: reserved.error };
  }

  const paytr = await refundPaytrOrder(
    reserved.merchantOid,
    amountTry,
    paytrRefundReference(idempotencyKey)
  );
  if (!paytr.ok) {
    await prisma.refundAttempt.update({
      where: { id: reserved.attempt.id },
      data: {
        status: "failed",
        paytrResponse: paytr.error,
        completedAt: new Date()
      }
    });
    return { ok: false as const, error: paytr.error };
  }

  const finalized = await finalizeSuccessfulRefund(
    reserved.attempt.id,
    paytr.alreadyRefunded ? "already_refunded" : "success"
  );
  return {
    ok: true as const,
    duplicate: false,
    fullRefund: finalized.fullRefund
  };
}

export async function reconcilePendingRefunds(now = new Date()) {
  const pending = await prisma.refundAttempt.findMany({
    where: {
      status: "pending",
      createdAt: { lte: new Date(now.getTime() - 5 * 60 * 1000) }
    },
    include: { order: true },
    take: 50
  });
  let reconciled = 0;
  let failed = 0;
  for (const attempt of pending) {
    if (!attempt.order.paytrMerchantOid) continue;
    const status = await queryPaytrOrderStatus(attempt.order.paytrMerchantOid);
    if (!status.ok) continue;
    const reference = paytrRefundReference(attempt.idempotencyKey);
    const matched = status.returns.find(
      (refund) =>
        refund.referenceNo === reference &&
        roundTry(refund.amountTry) === roundTry(Number(attempt.amountTry))
    );
    if (matched) {
      await finalizeSuccessfulRefund(
        attempt.id,
        `reconciled:${matched.referenceNo}`
      );
      reconciled += 1;
    } else if (now.getTime() - attempt.createdAt.getTime() >= 24 * 60 * 60 * 1000) {
      await prisma.refundAttempt.updateMany({
        where: { id: attempt.id, status: "pending" },
        data: {
          status: "failed",
          paytrResponse: "reconciled_not_found",
          completedAt: now
        }
      });
      failed += 1;
    }
  }
  return { checked: pending.length, reconciled, failed };
}
