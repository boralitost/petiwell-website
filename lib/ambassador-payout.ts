import { prisma } from "@/lib/db";
import { ambassadorConfig } from "@/lib/ambassador-config";
import { approveEligibleAmbassadorCommissions } from "@/lib/ambassador-commission";
import { roundTry } from "@/lib/ambassador-pricing";
import { sendAmbassadorOperationalEmail } from "@/lib/email";

const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;

function turkeyParts(date: Date) {
  const shifted = new Date(date.getTime() + ISTANBUL_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate()
  };
}

function turkeyMidnightUtc(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day) - ISTANBUL_OFFSET_MS);
}

export function payoutPeriodFor(date = new Date()) {
  const { year, month, day } = turkeyParts(date);
  const cutoffDay = day >= 15 ? 15 : 1;
  const periodEnd = turkeyMidnightUtc(year, month, cutoffDay);
  const periodStart =
    cutoffDay === 15
      ? turkeyMidnightUtc(year, month, 1)
      : turkeyMidnightUtc(year, month - 1, 15);
  return { periodStart, periodEnd, cutoffAt: date };
}

export async function createDueAmbassadorPayouts(now = new Date()) {
  await approveEligibleAmbassadorCommissions(now);
  const period = payoutPeriodFor(now);
  const ambassadors = await prisma.ambassador.findMany({
    where: {
      taxStatusValid: true,
      ibanEncrypted: { not: null },
      commissions: {
        some: {
          status: "APPROVED",
          payoutId: null,
          approvedAt: { lte: period.periodEnd }
        }
      }
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      taxType: true,
      commissions: {
        where: {
          status: "APPROVED",
          payoutId: null,
          approvedAt: { lte: period.periodEnd }
        },
        select: { id: true, commissionAmount: true }
      },
      adjustments: {
        where: { payoutId: null, status: "PENDING" },
        select: { id: true, amount: true }
      }
    }
  });
  let created = 0;
  for (const ambassador of ambassadors) {
    const commissionTotal = roundTry(
      ambassador.commissions.reduce(
        (sum, commission) => sum + Number(commission.commissionAmount),
        0
      )
    );
    const adjustmentsTotal = roundTry(
      ambassador.adjustments.reduce(
        (sum, adjustment) => sum + Number(adjustment.amount),
        0
      )
    );
    const netPayout = roundTry(commissionTotal + adjustmentsTotal);
    if (netPayout < ambassadorConfig().minPayoutTry) continue;
    const existing = await prisma.ambassadorPayout.findUnique({
      where: {
        ambassadorId_periodStart_periodEnd: {
          ambassadorId: ambassador.id,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd
        }
      },
      select: { id: true }
    });
    if (existing) continue;
    await prisma.$transaction(async (tx) => {
      const payout = await tx.ambassadorPayout.create({
        data: {
          ambassadorId: ambassador.id,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          cutoffAt: period.cutoffAt,
          approvedCommissionTotal: commissionTotal,
          adjustmentsTotal,
          netPayout,
          scheduledFor: period.periodEnd,
          status:
            ambassador.taxType === "BUSINESS_INVOICE"
              ? "WAITING_DOCUMENT"
              : "READY"
        }
      });
      await tx.ambassadorCommission.updateMany({
        where: {
          id: { in: ambassador.commissions.map((row) => row.id) },
          payoutId: null,
          status: "APPROVED"
        },
        data: { payoutId: payout.id }
      });
      await tx.ambassadorCommissionAdjustment.updateMany({
        where: {
          id: { in: ambassador.adjustments.map((row) => row.id) },
          payoutId: null,
          status: "PENDING"
        },
        data: { payoutId: payout.id, status: "APPLIED" }
      });
    });
    await sendAmbassadorOperationalEmail({
      to: ambassador.email,
      firstName: ambassador.firstName,
      kind:
        ambassador.taxType === "BUSINESS_INVOICE"
          ? "payout_waiting_invoice"
          : "payout_ready",
      amountTry: netPayout,
      detail:
        ambassador.taxType === "BUSINESS_INVOICE"
          ? "Ödeme dönemine ait faturayı Elçi panelinden yükleyebilirsin."
          : "Komisyon ödemen banka transferi için hazırlandı."
    }).catch(() => undefined);
    created += 1;
  }
  return { created, period };
}

export async function markAmbassadorPayoutPaid(input: {
  payoutId: string;
  bankReference: string;
}) {
  const payout = await prisma.ambassadorPayout.findUnique({
    where: { id: input.payoutId },
    include: { ambassador: true }
  });
  if (!payout) return { ok: false as const, error: "payout_not_found" };
  if (payout.status !== "READY") {
    return { ok: false as const, error: "payout_not_ready" };
  }
  if (!payout.ambassador.taxStatusValid || !payout.ambassador.ibanEncrypted) {
    return { ok: false as const, error: "payout_identity_not_verified" };
  }
  const bankReference = input.bankReference.trim();
  if (bankReference.length < 3) {
    return { ok: false as const, error: "bank_reference_required" };
  }
  const now = new Date();
  await prisma.$transaction([
    prisma.ambassadorPayout.update({
      where: { id: payout.id },
      data: {
        status: "PAID",
        paidAt: now,
        bankReference: bankReference.slice(0, 160)
      }
    }),
    prisma.ambassadorCommission.updateMany({
      where: { payoutId: payout.id, status: "APPROVED" },
      data: { status: "PAID", paidAt: now }
    })
  ]);
  await sendAmbassadorOperationalEmail({
    to: payout.ambassador.email,
    firstName: payout.ambassador.firstName,
    kind: "payout_paid",
    amountTry: Number(payout.netPayout),
    detail: `Banka işlem referansı: ${bankReference}`
  }).catch(() => undefined);
  return { ok: true as const };
}
