import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { addDays, ambassadorConfig } from "@/lib/ambassador-config";
import { sendAmbassadorOperationalEmail } from "@/lib/email";
import { syncCommissionForOrderStatus } from "@/lib/ambassador-commission";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function verifyShipmentWebhookSignature(
  raw: string,
  signature: string,
  secret = process.env.SHIPMENT_WEBHOOK_SECRET || ""
) {
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (
    !verifyShipmentWebhookSignature(
      raw,
      req.headers.get("x-petiwell-signature") || ""
    )
  ) {
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const provider = String(body.provider || "carrier").slice(0, 80);
  const externalId = String(body.eventId || "").slice(0, 160);
  const eventType = String(body.eventType || "").toLowerCase();
  const trackingNumber = String(body.trackingNumber || "").trim().slice(0, 160);
  if (!externalId || !trackingNumber || eventType !== "delivered") {
    return NextResponse.json({ ok: false, error: "invalid_event" }, { status: 400 });
  }
  const existing = await prisma.integrationWebhookEvent.findUnique({
    where: { provider_externalId: { provider, externalId } }
  });
  if (existing?.status === "processed") {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const deliveredAtRaw = body.deliveredAt ? new Date(String(body.deliveredAt)) : new Date();
  const now = new Date();
  const deliveredAt =
    Number.isNaN(deliveredAtRaw.getTime()) ||
    Math.abs(deliveredAtRaw.getTime() - now.getTime()) > 30 * 24 * 60 * 60 * 1000
      ? now
      : deliveredAtRaw;
  const event =
    existing ||
    (await prisma.integrationWebhookEvent.create({
      data: {
        provider,
        externalId,
        eventType,
        payload: body as Prisma.InputJsonValue
      }
    }));
  try {
    const shipment = await prisma.ambassadorShipment.findFirst({
      where: { trackingNumber, status: "SHIPPED" },
      include: { ambassador: true }
    });
    if (shipment) {
      const config = ambassadorConfig();
      const firstDue = addDays(deliveredAt, config.firstContentDays);
      await prisma.$transaction([
        prisma.ambassadorShipment.update({
          where: { id: shipment.id },
          data: { deliveredAt, status: "DELIVERED" }
        }),
        prisma.ambassador.update({
          where: { id: shipment.ambassadorId },
          data: {
            status: "ACTIVE_PENDING_FIRST_CONTENT",
            firstContentDueAt: firstDue,
            firstContentFinalDueAt: addDays(
              firstDue,
              config.finalWarningDays
            ),
            lastActivityAt: deliveredAt
          }
        })
      ]);
      await sendAmbassadorOperationalEmail({
        to: shipment.ambassador.email,
        firstName: shipment.ambassador.firstName,
        kind: "package_delivered",
        dueAt: firstDue,
        detail:
          "Başlangıç paketin teslim edildi. İlk içeriğini panelden incelemeye gönder."
      }).catch(() => undefined);
    }

    const order = await prisma.order.findFirst({
      where: { trackingNumber, status: "shipped" },
      select: { id: true }
    });
    if (order) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "delivered" }
      });
      await syncCommissionForOrderStatus(order.id, "delivered");
    }
    const matched = Boolean(shipment || order);
    await prisma.integrationWebhookEvent.update({
      where: { id: event.id },
      data: {
        status: matched ? "processed" : "unmatched",
        processedAt: new Date()
      }
    });
    return NextResponse.json({ ok: true, matched });
  } catch (error) {
    const message = error instanceof Error ? error.message : "processing_failed";
    await prisma.integrationWebhookEvent.update({
      where: { id: event.id },
      data: {
        status: "failed",
        error: message.slice(0, 500),
        processedAt: new Date()
      }
    });
    return NextResponse.json(
      { ok: false, error: "processing_failed" },
      { status: 500 }
    );
  }
}
