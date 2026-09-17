import { NextRequest, NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import {
  auditAdminAction,
  createAmbassadorInvite,
  requestIp,
  reviewAmbassador
} from "@/lib/ambassador";
import { isSameOriginRequest } from "@/lib/ambassador-security";
import { addDays, ambassadorConfig } from "@/lib/ambassador-config";
import {
  sendAmbassadorOperationalEmail,
  sendAmbassadorShipmentEmail
} from "@/lib/email";
import { markAmbassadorPayoutPaid } from "@/lib/ambassador-payout";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdminRole(["SUPER_ADMIN", "OPERATIONS"]))) {
    return unauthorized();
  }
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ ok: false, error: "invalid_origin" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const result = await createAmbassadorInvite({
    firstName: String(body.firstName || ""),
    lastName: String(body.lastName || ""),
    email: String(body.email || ""),
    socialHandle: String(body.socialHandle || ""),
    ipAddress: requestIp(req.headers)
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

export async function PATCH(req: NextRequest) {
  const principal = await requireAdminRole([
    "SUPER_ADMIN",
    "OPERATIONS",
    "FINANCE",
    "CONTENT_REVIEW"
  ]);
  if (!principal) return unauthorized();
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ ok: false, error: "invalid_origin" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const rolesByAction: Record<string, string[]> = {
    verify_tax: ["SUPER_ADMIN", "FINANCE"],
    mark_payout_paid: ["SUPER_ADMIN", "FINANCE"],
    review_content: ["SUPER_ADMIN", "CONTENT_REVIEW"],
    review_document: ["SUPER_ADMIN", "OPERATIONS", "FINANCE"],
    approve: ["SUPER_ADMIN", "OPERATIONS"],
    missing_documents: ["SUPER_ADMIN", "OPERATIONS"],
    reject: ["SUPER_ADMIN", "OPERATIONS"],
    ship_welcome: ["SUPER_ADMIN", "OPERATIONS"],
    deliver_welcome: ["SUPER_ADMIN", "OPERATIONS"],
    pause: ["SUPER_ADMIN", "OPERATIONS"],
    resume: ["SUPER_ADMIN", "OPERATIONS"],
    terminate: ["SUPER_ADMIN"],
    review_fraud: ["SUPER_ADMIN", "OPERATIONS"]
  };
  const allowed = rolesByAction[action] || [];
  if (!allowed.includes(principal.role)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const ambassadorId = String(body.ambassadorId || "");
  const ipAddress = requestIp(req.headers);
  if (!ambassadorId) {
    return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
  }

  if (action === "approve" || action === "missing_documents" || action === "reject") {
    const result = await reviewAmbassador({
      ambassadorId,
      action,
      reason: String(body.reason || ""),
      couponCode: String(body.couponCode || ""),
      ipAddress
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  if (action === "verify_tax") {
    const existing = await prisma.ambassador.findUnique({
      where: { id: ambassadorId },
      select: { id: true, taxStatusValid: true, taxVerifiedAt: true }
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    const valid = body.valid === true;
    await prisma.ambassador.update({
      where: { id: ambassadorId },
      data: {
        taxStatusValid: valid,
        taxVerifiedAt: valid ? new Date() : null
      }
    });
    await auditAdminAction({
      action: valid ? "AMBASSADOR_TAX_VERIFIED" : "AMBASSADOR_TAX_REVOKED",
      entityType: "Ambassador",
      entityId: ambassadorId,
      ambassadorId,
      oldValue: { taxStatusValid: existing.taxStatusValid },
      newValue: { taxStatusValid: valid },
      ipAddress
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "review_document") {
    const documentId = String(body.documentId || "");
    const status = String(body.status || "");
    if (!["APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json(
        { ok: false, error: "invalid_document_status" },
        { status: 400 }
      );
    }
    const document = await prisma.ambassadorDocument.findFirst({
      where: { id: documentId, ambassadorId }
    });
    if (!document) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    const reviewedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.ambassadorDocument.update({
        where: { id: document.id },
        data: {
          status: status as "APPROVED" | "REJECTED",
          reviewedAt,
          reviewedBy: "admin",
          rejectionReason:
            status === "REJECTED"
              ? String(body.reason || "").slice(0, 500)
              : null
        }
      });
      if (document.documentType === "PAYOUT_INVOICE") {
        await tx.ambassadorPayout.updateMany({
          where: {
            ambassadorId,
            invoiceDocumentId: document.id,
            status: "WAITING_DOCUMENT"
          },
          data: {
            status: status === "APPROVED" ? "READY" : "WAITING_DOCUMENT",
            invoiceVerifiedAt: status === "APPROVED" ? reviewedAt : null
          }
        });
      }
    });
    await auditAdminAction({
      action: `AMBASSADOR_DOCUMENT_${status}`,
      entityType: "AmbassadorDocument",
      entityId: document.id,
      ambassadorId,
      oldValue: { status: document.status },
      newValue: { status, reason: String(body.reason || "").slice(0, 500) },
      ipAddress
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "review_content") {
    const contentId = String(body.contentId || "");
    const status = String(body.status || "");
    if (
      ![
        "APPROVED",
        "CHANGES_REQUESTED",
        "PUBLISHED",
        "REMOVAL_REQUESTED"
      ].includes(status)
    ) {
      return NextResponse.json(
        { ok: false, error: "invalid_content_status" },
        { status: 400 }
      );
    }
    const content = await prisma.ambassadorContent.findFirst({
      where: { id: contentId, ambassadorId }
    });
    if (!content) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    const now = new Date();
    const urgent = status === "REMOVAL_REQUESTED";
    const correctionDueAt =
      status === "CHANGES_REQUESTED"
        ? new Date(
            now.getTime() +
              ambassadorConfig().standardCorrectionHours * 60 * 60 * 1000
          )
        : urgent
          ? new Date(
              now.getTime() +
                ambassadorConfig().urgentCorrectionHours * 60 * 60 * 1000
            )
          : null;
    await prisma.$transaction(async (tx) => {
      await tx.ambassadorContent.update({
        where: { id: content.id },
        data: {
          status: status as
            | "APPROVED"
            | "CHANGES_REQUESTED"
            | "PUBLISHED"
            | "REMOVAL_REQUESTED",
          reviewedAt: now,
          publishedAt: status === "PUBLISHED" ? now : content.publishedAt,
          reviewNotes: String(body.reviewNotes || "").slice(0, 2000) || null,
          correctionDueAt:
            status === "CHANGES_REQUESTED" ? correctionDueAt : null,
          urgentRemovalDueAt: urgent ? correctionDueAt : null,
          productVisible:
            typeof body.productVisible === "boolean"
              ? body.productVisible
              : content.productVisible,
          disclosurePresent:
            typeof body.disclosurePresent === "boolean"
              ? body.disclosurePresent
              : content.disclosurePresent,
          couponVisible:
            typeof body.couponVisible === "boolean"
              ? body.couponVisible
              : content.couponVisible,
          petiwellTagged:
            typeof body.petiwellTagged === "boolean"
              ? body.petiwellTagged
              : content.petiwellTagged,
          healthClaimsOk:
            typeof body.healthClaimsOk === "boolean"
              ? body.healthClaimsOk
              : content.healthClaimsOk,
          productInfoOk:
            typeof body.productInfoOk === "boolean"
              ? body.productInfoOk
              : content.productInfoOk
        }
      });
      if (status === "PUBLISHED" && content.isFirstContent) {
        await tx.ambassador.update({
          where: { id: ambassadorId },
          data: {
            status: "ACTIVE",
            lastActivityAt: now
          }
        });
      }
    });
    await auditAdminAction({
      action: `AMBASSADOR_CONTENT_${status}`,
      entityType: "AmbassadorContent",
      entityId: content.id,
      ambassadorId,
      oldValue: { status: content.status },
      newValue: {
        status,
        reviewNotes: String(body.reviewNotes || "").slice(0, 2000)
      },
      ipAddress
    });
    const recipient = await prisma.ambassador.findUnique({
      where: { id: ambassadorId },
      select: { email: true, firstName: true }
    });
    if (recipient) {
      await sendAmbassadorOperationalEmail({
        to: recipient.email,
        firstName: recipient.firstName,
        kind: "content_review",
        dueAt: correctionDueAt,
        detail: [
          `İçerik durumu: ${status}`,
          String(body.reviewNotes || "").slice(0, 2000)
        ]
          .filter(Boolean)
          .join(" — ")
      }).catch(() => undefined);
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "mark_payout_paid") {
    const payoutId = String(body.payoutId || "");
    const payout = await prisma.ambassadorPayout.findFirst({
      where: { id: payoutId, ambassadorId }
    });
    if (!payout) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    const result = await markAmbassadorPayoutPaid({
      payoutId,
      bankReference: String(body.bankReference || "")
    });
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    await auditAdminAction({
      action: "AMBASSADOR_PAYOUT_PAID",
      entityType: "AmbassadorPayout",
      entityId: payoutId,
      ambassadorId,
      oldValue: { status: payout.status },
      newValue: {
        status: "PAID",
        bankReference: String(body.bankReference || "").slice(0, 160)
      },
      ipAddress
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "review_fraud") {
    const flagId = String(body.flagId || "");
    const status = String(body.status || "");
    if (!["RESOLVED", "DISMISSED"].includes(status)) {
      return NextResponse.json(
        { ok: false, error: "invalid_fraud_status" },
        { status: 400 }
      );
    }
    const flag = await prisma.ambassadorFraudFlag.findFirst({
      where: { id: flagId, ambassadorId }
    });
    if (!flag) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    await prisma.$transaction(async (tx) => {
      await tx.ambassadorFraudFlag.update({
        where: { id: flag.id },
        data: {
          status: status as "RESOLVED" | "DISMISSED",
          reviewedAt: new Date(),
          reviewedBy: "admin",
          notes: [flag.notes, String(body.note || "").slice(0, 1000)]
            .filter(Boolean)
            .join("\n")
        }
      });
      if (flag.orderId) {
        await tx.ambassadorCommission.updateMany({
          where: { orderId: flag.orderId, status: "UNDER_REVIEW" },
          data:
            status === "DISMISSED"
              ? { status: "PENDING" }
              : {
                  status: "CANCELLED",
                  cancelledAt: new Date(),
                  cancellationReason: `fraud:${flag.type}`
                }
        });
      }
    });
    await auditAdminAction({
      action: `AMBASSADOR_FRAUD_${status}`,
      entityType: "AmbassadorFraudFlag",
      entityId: flag.id,
      ambassadorId,
      oldValue: { status: flag.status },
      newValue: {
        status,
        note: String(body.note || "").slice(0, 1000)
      },
      ipAddress
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "pause" || action === "resume" || action === "terminate") {
    const existing = await prisma.ambassador.findUnique({
      where: { id: ambassadorId },
      select: {
        id: true,
        status: true,
        contents: {
          where: { isFirstContent: true, status: "PUBLISHED" },
          select: { id: true },
          take: 1
        },
        shipments: {
          where: { shipmentType: "WELCOME_PACKAGE", status: "DELIVERED" },
          select: { id: true },
          take: 1
        }
      }
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    const now = new Date();
    const nextStatus =
      action === "pause"
        ? "PAUSED"
        : action === "terminate"
          ? "TERMINATED"
          : existing.contents.length
            ? "ACTIVE"
            : existing.shipments.length
              ? "ACTIVE_PENDING_FIRST_CONTENT"
              : "ACTIVE_PENDING_SHIPMENT";
    await prisma.$transaction([
      prisma.ambassador.update({
        where: { id: ambassadorId },
        data: {
          status: nextStatus,
          referralActive: action === "resume",
          pausedAt: action === "pause" ? now : null,
          terminatedAt: action === "terminate" ? now : null
        }
      }),
      prisma.ambassadorCoupon.updateMany({
        where: { ambassadorId },
        data: {
          active: action === "resume",
          disabledAt: action === "resume" ? null : now
        }
      })
    ]);
    await auditAdminAction({
      action: `AMBASSADOR_${action.toUpperCase()}`,
      entityType: "Ambassador",
      entityId: ambassadorId,
      ambassadorId,
      oldValue: { status: existing.status },
      newValue: {
        status: nextStatus,
        reason: String(body.reason || "").slice(0, 500)
      },
      ipAddress
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "ship_welcome" || action === "deliver_welcome") {
    const shipment = await prisma.ambassadorShipment.findFirst({
      where: {
        ambassadorId,
        shipmentType: "WELCOME_PACKAGE",
        status: { not: "CANCELLED" }
      },
      orderBy: { createdAt: "desc" }
    });
    if (!shipment) {
      return NextResponse.json(
        { ok: false, error: "shipment_not_found" },
        { status: 404 }
      );
    }
    const now = new Date();
    if (action === "ship_welcome") {
      const carrier = String(body.carrier || "").trim();
      const trackingNumber = String(body.trackingNumber || "").trim();
      if (!carrier || trackingNumber.length < 5) {
        return NextResponse.json(
          { ok: false, error: "shipping_fields_required" },
          { status: 400 }
        );
      }
      await prisma.$transaction([
        prisma.ambassadorShipment.update({
          where: { id: shipment.id },
          data: {
            carrier: carrier.slice(0, 80),
            trackingNumber: trackingNumber.slice(0, 120),
            shippedAt: now,
            status: "SHIPPED"
          }
        }),
        prisma.ambassador.update({
          where: { id: ambassadorId },
          data: { status: "ACTIVE_PENDING_SHIPMENT", lastActivityAt: now }
        })
      ]);
      const recipient = await prisma.ambassador.findUnique({
        where: { id: ambassadorId },
        select: { email: true, firstName: true }
      });
      if (recipient) {
        await sendAmbassadorShipmentEmail({
          to: recipient.email,
          firstName: recipient.firstName,
          carrier,
          trackingNumber
        }).catch(() => undefined);
      }
    } else {
      if (shipment.status !== "SHIPPED") {
        return NextResponse.json(
          { ok: false, error: "shipment_not_shipped" },
          { status: 409 }
        );
      }
      const config = ambassadorConfig();
      const firstDue = addDays(now, config.firstContentDays);
      await prisma.$transaction([
        prisma.ambassadorShipment.update({
          where: { id: shipment.id },
          data: { deliveredAt: now, status: "DELIVERED" }
        }),
        prisma.ambassador.update({
          where: { id: ambassadorId },
          data: {
            status: "ACTIVE_PENDING_FIRST_CONTENT",
            firstContentDueAt: firstDue,
            firstContentFinalDueAt: addDays(firstDue, config.finalWarningDays),
            lastActivityAt: now
          }
        })
      ]);
      const recipient = await prisma.ambassador.findUnique({
        where: { id: ambassadorId },
        select: { email: true, firstName: true }
      });
      if (recipient) {
        await sendAmbassadorOperationalEmail({
          to: recipient.email,
          firstName: recipient.firstName,
          kind: "package_delivered",
          dueAt: firstDue,
          detail:
            "Başlangıç paketin teslim edildi. İlk kalıcı içeriğini panelden incelemeye gönder."
        }).catch(() => undefined);
      }
    }
    await auditAdminAction({
      action:
        action === "ship_welcome"
          ? "AMBASSADOR_WELCOME_SHIPPED"
          : "AMBASSADOR_WELCOME_DELIVERED",
      entityType: "AmbassadorShipment",
      entityId: shipment.id,
      ambassadorId,
      newValue: {
        carrier: String(body.carrier || ""),
        trackingNumber: String(body.trackingNumber || "")
      },
      ipAddress
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { ok: false, error: "invalid_action" },
    { status: 400 }
  );
}
