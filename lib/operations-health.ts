import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { sendOperationsAlertEmail } from "@/lib/email";

export async function getOperationsHealth(now = new Date()) {
  const staleRefundBefore = new Date(now.getTime() - 15 * 60 * 1000);
  const scannerStaleBefore = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const [
    staleRefunds,
    failedWebhooks,
    unmatchedWebhooks,
    failedNotifications,
    failedPayouts,
    highFraud,
    scanner
  ] = await Promise.all([
    prisma.refundAttempt.count({
      where: { status: "pending", createdAt: { lte: staleRefundBefore } }
    }),
    prisma.integrationWebhookEvent.count({ where: { status: "failed" } }),
    prisma.integrationWebhookEvent.count({ where: { status: "unmatched" } }),
    prisma.ambassadorNotification.count({ where: { status: "failed" } }),
    prisma.ambassadorPayout.count({ where: { status: "FAILED" } }),
    prisma.ambassadorFraudFlag.count({
      where: { status: { in: ["OPEN", "REVIEWING"] }, severity: "HIGH" }
    }),
    prisma.systemConfig.findUnique({ where: { key: "clamav_snapshot_id" } })
  ]);
  const scannerStale =
    !scanner || scanner.updatedAt.getTime() <= scannerStaleBefore.getTime();
  const issues = [
    staleRefunds
      ? `${staleRefunds} iade 15 dakikadan uzun süredir bekliyor`
      : "",
    failedWebhooks ? `${failedWebhooks} webhook işlenemedi` : "",
    unmatchedWebhooks ? `${unmatchedWebhooks} kargo olayı eşleşmedi` : "",
    failedNotifications
      ? `${failedNotifications} Elçi bildirimi gönderilemedi`
      : "",
    failedPayouts ? `${failedPayouts} payout başarısız` : "",
    highFraud ? `${highFraud} yüksek riskli fraud kaydı açık` : "",
    scannerStale ? "ClamAV imza snapshot'ı güncel değil" : ""
  ].filter(Boolean);
  return {
    ok: issues.length === 0,
    checkedAt: now,
    issues,
    counts: {
      staleRefunds,
      failedWebhooks,
      unmatchedWebhooks,
      failedNotifications,
      failedPayouts,
      highFraud
    },
    scannerUpdatedAt: scanner?.updatedAt || null
  };
}

export async function alertOperationsIfNeeded(now = new Date()) {
  const health = await getOperationsHealth(now);
  if (health.ok) return { alerted: false, health };
  const day = now.toISOString().slice(0, 10);
  const hash = createHash("sha256")
    .update(`${day}:${health.issues.sort().join("|")}`)
    .digest("hex");
  const key = "operations_alert_hash";
  const existing = await prisma.systemConfig.findUnique({ where: { key } });
  if (existing?.value === hash) return { alerted: false, health };
  const sent = await sendOperationsAlertEmail({
    subject: "Müdahale gerekiyor",
    lines: health.issues
  });
  if (sent.ok) {
    await prisma.systemConfig.upsert({
      where: { key },
      create: { key, value: hash },
      update: { value: hash }
    });
  }
  return { alerted: sent.ok, health };
}
