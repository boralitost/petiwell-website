import { prisma } from "@/lib/db";

function normalizeAddress(value: string) {
  return value.toLocaleUpperCase("tr-TR").replace(/[^\p{L}\p{N}]+/gu, "");
}

async function flagOnce(input: {
  ambassadorId: string;
  orderId?: string | null;
  type:
    | "REPEATED_ADDRESS"
    | "ABNORMAL_REFUND_RATE"
    | "COUPON_SITE_LEAK"
    | "SUSPICIOUS_ORDER_PATTERN";
  severity: "LOW" | "MEDIUM" | "HIGH";
  notes: string;
}) {
  const existing = await prisma.ambassadorFraudFlag.findFirst({
    where: {
      ambassadorId: input.ambassadorId,
      orderId: input.orderId || null,
      type: input.type,
      status: { in: ["OPEN", "REVIEWING"] }
    },
    select: { id: true }
  });
  if (existing) return false;
  await prisma.ambassadorFraudFlag.create({
    data: {
      ambassadorId: input.ambassadorId,
      orderId: input.orderId || null,
      type: input.type,
      severity: input.severity,
      notes: input.notes
    }
  });
  return true;
}

export async function evaluateAmbassadorOrderFraud(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      ambassadorId: true,
      customerEmail: true,
      shippingAddress: true,
      createdAt: true
    }
  });
  if (!order?.ambassadorId) return { flags: 0 };
  const thirtyDaysAgo = new Date(order.createdAt.getTime() - 30 * 24 * 60 * 60 * 1000);
  const oneHourAgo = new Date(order.createdAt.getTime() - 60 * 60 * 1000);
  const recent = await prisma.order.findMany({
    where: {
      ambassadorId: order.ambassadorId,
      createdAt: { gte: thirtyDaysAgo, lte: order.createdAt },
      paymentStatus: "success"
    },
    select: {
      id: true,
      customerEmail: true,
      shippingAddress: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" },
    take: 500
  });
  let flags = 0;
  const sameAddress = recent.filter(
    (row) =>
      normalizeAddress(row.shippingAddress) ===
      normalizeAddress(order.shippingAddress)
  );
  if (new Set(sameAddress.map((row) => row.customerEmail)).size >= 3) {
    if (
      await flagOnce({
        ambassadorId: order.ambassadorId,
        orderId: order.id,
        type: "REPEATED_ADDRESS",
        severity: "HIGH",
        notes:
          "Aynı teslimat adresi son 30 günde en az üç farklı müşteri e-postasıyla kullanıldı."
      })
    )
      flags += 1;
  }

  const hourly = recent.filter((row) => row.createdAt >= oneHourAgo);
  if (hourly.length >= 10) {
    if (
      await flagOnce({
        ambassadorId: order.ambassadorId,
        orderId: order.id,
        type: "SUSPICIOUS_ORDER_PATTERN",
        severity: "MEDIUM",
        notes: "Aynı Elçi attribution'ında bir saat içinde 10 veya daha fazla ödeme oluştu."
      })
    )
      flags += 1;
  }
  if (new Set(hourly.map((row) => row.customerEmail)).size >= 20) {
    if (
      await flagOnce({
        ambassadorId: order.ambassadorId,
        orderId: order.id,
        type: "COUPON_SITE_LEAK",
        severity: "MEDIUM",
        notes:
          "Bir saat içinde çok yüksek sayıda farklı müşteri Elçi attribution'ını kullandı."
      })
    )
      flags += 1;
  }
  if (flags) {
    await prisma.ambassadorCommission.updateMany({
      where: { orderId, status: "PENDING" },
      data: { status: "UNDER_REVIEW" }
    });
  }
  return { flags };
}

export async function evaluateAmbassadorRefundRate(ambassadorId: string) {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const commissions = await prisma.ambassadorCommission.findMany({
    where: { ambassadorId, createdAt: { gte: since } },
    select: { status: true }
  });
  if (commissions.length < 5) return { flagged: false };
  const adverse = commissions.filter((row) =>
    ["CANCELLED", "ADJUSTED"].includes(row.status)
  ).length;
  const rate = adverse / commissions.length;
  if (rate < 0.4) return { flagged: false };
  const flagged = await flagOnce({
    ambassadorId,
    type: "ABNORMAL_REFUND_RATE",
    severity: "HIGH",
    notes: `Son 90 günlük komisyonlarda iptal/iade oranı %${Math.round(rate * 100)}.`
  });
  if (flagged) {
    await prisma.ambassadorCommission.updateMany({
      where: { ambassadorId, status: "PENDING" },
      data: { status: "UNDER_REVIEW" }
    });
  }
  return { flagged };
}
