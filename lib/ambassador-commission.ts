import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { addDays, ambassadorConfig } from "@/lib/ambassador-config";
import { evaluateAmbassadorRefundRate } from "@/lib/ambassador-fraud";

export async function syncCommissionForOrderStatus(
  orderId: string,
  status: OrderStatus
) {
  const commission = await prisma.ambassadorCommission.findUnique({
    where: { orderId },
    include: { adjustments: true }
  });
  if (!commission) return;
  const now = new Date();
  if (status === "delivered" && commission.status === "PENDING") {
    await prisma.ambassadorCommission.update({
      where: { id: commission.id },
      data: {
        eligibleAt: addDays(now, ambassadorConfig().commissionHoldDays)
      }
    });
    return;
  }
  if (status !== "cancelled" && status !== "refunded") return;
  if (commission.status === "PAID") {
    const adjustedAlready = commission.adjustments.reduce(
      (sum, adjustment) => sum + Number(adjustment.amount),
      0
    );
    const remaining = Math.max(
      0,
      Number(commission.commissionAmount) + adjustedAlready
    );
    if (remaining <= 0) return;
    await prisma.$transaction([
      prisma.ambassadorCommission.update({
        where: { id: commission.id },
        data: {
          status: "ADJUSTED",
          cancelledAt: now,
          cancellationReason: status
        }
      }),
      prisma.ambassadorCommissionAdjustment.create({
        data: {
          ambassadorId: commission.ambassadorId,
          commissionId: commission.id,
          amount: -remaining,
          reason:
            status === "refunded"
              ? "FULL_REFUND_AFTER_PAYOUT"
              : "MANUAL_CORRECTION",
          note: `Sipariş durumu: ${status}`,
          status: "PENDING"
        }
      })
    ]);
    await evaluateAmbassadorRefundRate(commission.ambassadorId).catch(
      () => undefined
    );
    return;
  }
  if (
    ["PENDING", "APPROVED", "UNDER_REVIEW"].includes(commission.status)
  ) {
    await prisma.$transaction([
      prisma.ambassadorCommission.update({
        where: { id: commission.id },
        data: {
          status: "CANCELLED",
          cancelledAt: now,
          cancellationReason: status
        }
      }),
      prisma.ambassadorCommissionAdjustment.updateMany({
        where: {
          commissionId: commission.id,
          payoutId: null,
          status: "PENDING"
        },
        data: { status: "CANCELLED" }
      })
    ]);
    await evaluateAmbassadorRefundRate(commission.ambassadorId).catch(
      () => undefined
    );
  }
}

export async function approveEligibleAmbassadorCommissions(now = new Date()) {
  return prisma.ambassadorCommission.updateMany({
    where: {
      status: "PENDING",
      eligibleAt: { lte: now },
      order: {
        status: "delivered",
        paymentStatus: "success"
      },
      ambassador: {
        status: {
          in: [
            "ACTIVE_PENDING_SHIPMENT",
            "ACTIVE_PENDING_FIRST_CONTENT",
            "ACTIVE"
          ]
        }
      }
    },
    data: {
      status: "APPROVED",
      approvedAt: now
    }
  });
}
