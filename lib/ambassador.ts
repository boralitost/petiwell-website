import { randomBytes } from "crypto";
import type {
  AmbassadorConsentType,
  AmbassadorDocumentType,
  AmbassadorStatus,
  AmbassadorTaxType,
  Prisma
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  LOGIN_COOLDOWN_MS,
  LOGIN_MAX_PER_HOUR,
  OTP_TTL_MS,
  createOtpCode,
  hashOtp,
  isValidEmail,
  normalizeEmail
} from "@/lib/account-auth";
import {
  sendAmbassadorApprovedEmail,
  sendAmbassadorInviteEmail,
  sendAmbassadorReviewEmail,
  sendOtpEmail
} from "@/lib/email";
import { addDays, ambassadorConfig } from "@/lib/ambassador-config";
import {
  couponCandidates,
  normalizeAmbassadorCoupon
} from "@/lib/ambassador-coupon";
import {
  AMBASSADOR_LEGAL_DOCUMENTS,
  ambassadorLegalDocsApproved
} from "@/lib/ambassador-documents";
import {
  encryptSensitive,
  hashPrivateValue,
  isAdultOn,
  isValidTckn,
  isValidTrIban,
  isValidTrPhone,
  maskedLast4,
  normalizeIban,
  normalizeSocialHandle,
  normalizeTrPhone
} from "@/lib/ambassador-security";
import { isValidTrLocation } from "@/lib/tr-locations";
import { getAdminPrincipal } from "@/lib/admin-auth";

export type AmbassadorProfileInput = {
  firstName: string;
  lastName: string;
  birthDate: string;
  email: string;
  phone: string;
  shippingAddress: string;
  city: string;
  district: string;
  postalCode?: string;
  primarySocialPlatform: string;
  instagramUsername?: string;
  tiktokUsername?: string;
  youtubeUsername?: string;
  otherSocialUrl?: string;
};

export type AmbassadorTaxInput = {
  taxType: AmbassadorTaxType;
  taxId: string;
  taxOffice?: string;
  businessName?: string;
  invoiceAddress?: string;
  iban: string;
  ibanHolderName: string;
  bankOwnershipConfirmed: boolean;
};

export async function auditAdminAction(input: {
  action: string;
  entityType: string;
  entityId: string;
  ambassadorId?: string | null;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  ipAddress?: string;
}) {
  const principal = await getAdminPrincipal().catch(() => null);
  await prisma.adminAuditLog.create({
    data: {
      adminId: principal?.email || "admin",
      adminUserId: principal?.databaseUser ? principal.id : null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      ambassadorId: input.ambassadorId || null,
      oldValue: input.oldValue,
      newValue: input.newValue,
      ipAddressHash: input.ipAddress ? hashPrivateValue(input.ipAddress) : null
    }
  });
}

export async function createAmbassadorInvite(input: {
  firstName?: string;
  lastName?: string;
  email?: string;
  socialHandle?: string;
  ipAddress?: string;
}) {
  if (!ambassadorLegalDocsApproved()) {
    return { ok: false as const, error: "legal_documents_not_approved" };
  }
  const email = input.email ? normalizeEmail(input.email) : "";
  if (email && !isValidEmail(email)) {
    return { ok: false as const, error: "invalid_email" };
  }
  const rawToken = randomBytes(32).toString("base64url");
  const invite = await prisma.ambassadorInvite.create({
    data: {
      tokenHash: hashPrivateValue(rawToken),
      email: email || null,
      firstName: (input.firstName || "").trim(),
      lastName: (input.lastName || "").trim(),
      socialHandle: normalizeSocialHandle(input.socialHandle || ""),
      expiresAt: addDays(new Date(), ambassadorConfig().inviteDays)
    }
  });
  await auditAdminAction({
    action: "AMBASSADOR_INVITE_CREATED",
    entityType: "AmbassadorInvite",
    entityId: invite.id,
    newValue: {
      email: invite.email || "",
      expiresAt: invite.expiresAt.toISOString()
    },
    ipAddress: input.ipAddress
  });
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || "https://petiwell.com").replace(
    /\/+$/,
    ""
  );
  const onboardingUrl = `${origin}/tr/marka-elcisi/onboarding/${rawToken}`;
  if (invite.email) {
    await sendAmbassadorInviteEmail({
      to: invite.email,
      firstName: invite.firstName,
      onboardingUrl,
      expiresAt: invite.expiresAt
    }).catch(() => undefined);
  }
  return {
    ok: true as const,
    invite,
    token: rawToken,
    onboardingUrl
  };
}

export async function getValidAmbassadorInvite(rawToken: string) {
  if (!rawToken || rawToken.length < 32) return null;
  const invite = await prisma.ambassadorInvite.findUnique({
    where: { tokenHash: hashPrivateValue(rawToken) },
    include: { ambassador: { include: { documents: true } } }
  });
  if (
    !invite ||
    invite.revokedAt ||
    invite.expiresAt.getTime() <= Date.now() ||
    (invite.usedAt && !invite.ambassador)
  ) {
    return null;
  }
  return invite;
}

export async function saveAmbassadorProfile(
  rawToken: string,
  input: AmbassadorProfileInput
) {
  const invite = await getValidAmbassadorInvite(rawToken);
  if (!invite) return { ok: false as const, error: "invalid_invite" };
  if (
    invite.ambassador &&
    !["ONBOARDING", "MISSING_DOCUMENTS"].includes(invite.ambassador.status)
  ) {
    return { ok: false as const, error: "onboarding_locked" };
  }
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) return { ok: false as const, error: "invalid_email" };
  if (invite.email && normalizeEmail(invite.email) !== email) {
    return { ok: false as const, error: "invite_email_mismatch" };
  }
  const birthDate = new Date(`${input.birthDate}T00:00:00.000Z`);
  if (!isAdultOn(birthDate)) return { ok: false as const, error: "under_18" };
  if (!isValidTrPhone(input.phone)) {
    return { ok: false as const, error: "invalid_phone" };
  }
  if (!isValidTrLocation(input.city.trim(), input.district.trim())) {
    return { ok: false as const, error: "invalid_location" };
  }
  const instagram = normalizeSocialHandle(input.instagramUsername || "");
  const tiktok = normalizeSocialHandle(input.tiktokUsername || "");
  const youtube = (input.youtubeUsername || "").trim().slice(0, 200);
  const other = (input.otherSocialUrl || "").trim().slice(0, 500);
  if (!instagram && !tiktok && !youtube && !other) {
    return { ok: false as const, error: "social_required" };
  }
  if (
    !input.firstName.trim() ||
    !input.lastName.trim() ||
    !input.shippingAddress.trim() ||
    !input.primarySocialPlatform.trim()
  ) {
    return { ok: false as const, error: "required_fields" };
  }

  const data = {
    firstName: input.firstName.trim().slice(0, 80),
    lastName: input.lastName.trim().slice(0, 80),
    email,
    emailVerifiedAt:
      invite.ambassador?.email === email
        ? invite.ambassador.emailVerifiedAt
        : null,
    phone: normalizeTrPhone(input.phone),
    birthDate,
    shippingAddress: input.shippingAddress.trim().slice(0, 1000),
    city: input.city.trim(),
    district: input.district.trim(),
    postalCode: (input.postalCode || "").trim().slice(0, 12),
    primarySocialPlatform: input.primarySocialPlatform.trim().slice(0, 40),
    instagramUsername: instagram,
    tiktokUsername: tiktok,
    youtubeUsername: youtube,
    otherSocialUrl: other,
    onboardingStartedAt: invite.ambassador?.onboardingStartedAt || new Date(),
    onboardingStep: Math.max(2, invite.ambassador?.onboardingStep || 1)
  };
  const ambassador = invite.ambassador
    ? await prisma.ambassador.update({
        where: { id: invite.ambassador.id },
        data
      })
    : await prisma.ambassador.create({
        data: {
          ...data,
          publicId: `PE-${randomBytes(6).toString("hex").toUpperCase()}`,
          inviteId: invite.id,
          status: "ONBOARDING",
          invitedAt: invite.createdAt,
          commissionRate: ambassadorConfig().commissionRate,
          customerDiscountRate: ambassadorConfig().customerDiscountRate
        }
      });
  return { ok: true as const, ambassador };
}

export async function saveAmbassadorTax(
  rawToken: string,
  input: AmbassadorTaxInput
) {
  const invite = await getValidAmbassadorInvite(rawToken);
  const ambassador = invite?.ambassador;
  if (!ambassador) return { ok: false as const, error: "profile_required" };
  if (!["ONBOARDING", "MISSING_DOCUMENTS"].includes(ambassador.status)) {
    return { ok: false as const, error: "onboarding_locked" };
  }
  if (
    input.taxType !== "SOCIAL_CREATOR_20B" &&
    input.taxType !== "BUSINESS_INVOICE"
  ) {
    return { ok: false as const, error: "invalid_tax_type" };
  }
  const taxId = input.taxId.replace(/\D/g, "");
  if (input.taxType === "SOCIAL_CREATOR_20B" && !isValidTckn(taxId)) {
    return { ok: false as const, error: "invalid_tckn" };
  }
  if (
    input.taxType === "BUSINESS_INVOICE" &&
    !(/^\d{10}$/.test(taxId) || isValidTckn(taxId))
  ) {
    return { ok: false as const, error: "invalid_tax_id" };
  }
  const iban = normalizeIban(input.iban);
  if (!isValidTrIban(iban)) return { ok: false as const, error: "invalid_iban" };
  if (!input.ibanHolderName.trim()) {
    return { ok: false as const, error: "iban_holder_required" };
  }
  if (!input.bankOwnershipConfirmed) {
    return { ok: false as const, error: "bank_confirmation_required" };
  }
  if (
    input.taxType === "BUSINESS_INVOICE" &&
    (!input.businessName?.trim() ||
      !input.taxOffice?.trim() ||
      !input.invoiceAddress?.trim())
  ) {
    return { ok: false as const, error: "business_fields_required" };
  }
  const updated = await prisma.ambassador.update({
    where: { id: ambassador.id },
    data: {
      taxType: input.taxType,
      taxIdEncrypted: encryptSensitive(taxId),
      taxIdLast4: maskedLast4(taxId),
      taxOffice: input.taxOffice?.trim().slice(0, 160) || null,
      businessName: input.businessName?.trim().slice(0, 240) || null,
      invoiceAddress: input.invoiceAddress?.trim().slice(0, 1000) || null,
      ibanEncrypted: encryptSensitive(iban),
      ibanLast4: maskedLast4(iban),
      ibanHolderName: input.ibanHolderName.trim().slice(0, 160),
      bankOwnershipConfirmedAt: new Date(),
      onboardingStep: Math.max(3, ambassador.onboardingStep)
    }
  });
  return { ok: true as const, ambassador: updated };
}

export async function requestAmbassadorEmailCode(rawToken: string) {
  const invite = await getValidAmbassadorInvite(rawToken);
  const ambassador = invite?.ambassador;
  if (!ambassador) return { ok: false as const, error: "profile_required" };
  if (ambassador.emailVerifiedAt) return { ok: true as const };
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.loginToken.count({
    where: {
      email: ambassador.email,
      purpose: "ambassador_verify_email",
      createdAt: { gt: hourAgo }
    }
  });
  if (recent >= LOGIN_MAX_PER_HOUR) return { ok: true as const };
  const last = await prisma.loginToken.findFirst({
    where: { email: ambassador.email, purpose: "ambassador_verify_email" },
    orderBy: { createdAt: "desc" }
  });
  if (last && Date.now() - last.createdAt.getTime() < LOGIN_COOLDOWN_MS) {
    return { ok: true as const };
  }
  const code = createOtpCode();
  await prisma.loginToken.create({
    data: {
      email: ambassador.email,
      purpose: "ambassador_verify_email",
      tokenHash: hashOtp(ambassador.email, "ambassador_verify_email", code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS)
    }
  });
  await sendOtpEmail({
    to: ambassador.email,
    code,
    purpose: "ambassador_verify_email",
    locale: "tr"
  });
  return { ok: true as const };
}

export async function verifyAmbassadorEmailCode(rawToken: string, code: string) {
  const invite = await getValidAmbassadorInvite(rawToken);
  const ambassador = invite?.ambassador;
  if (!ambassador) return { ok: false as const, error: "profile_required" };
  const tokenHash = hashOtp(
    ambassador.email,
    "ambassador_verify_email",
    code
  );
  const row = await prisma.loginToken.findUnique({ where: { tokenHash } });
  if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
    return { ok: false as const, error: "invalid_code" };
  }
  await prisma.$transaction([
    prisma.loginToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() }
    }),
    prisma.ambassador.update({
      where: { id: ambassador.id },
      data: { emailVerifiedAt: new Date() }
    })
  ]);
  return { ok: true as const };
}

export async function submitAmbassadorOnboarding(input: {
  rawToken: string;
  acceptedTypes: AmbassadorConsentType[];
  ipAddress?: string;
  userAgent?: string;
}) {
  const invite = await getValidAmbassadorInvite(input.rawToken);
  if (!invite?.ambassador) {
    return { ok: false as const, error: "profile_required" };
  }
  const ambassador = await prisma.ambassador.findUnique({
    where: { id: invite.ambassador.id },
    include: { documents: true }
  });
  if (!ambassador?.emailVerifiedAt) {
    return { ok: false as const, error: "email_not_verified" };
  }
  if (!ambassador.taxType || !ambassador.taxIdEncrypted || !ambassador.ibanEncrypted) {
    return { ok: false as const, error: "tax_required" };
  }
  if (!ambassador.bankOwnershipConfirmedAt) {
    return { ok: false as const, error: "bank_confirmation_required" };
  }
  if (
    ambassador.taxType === "SOCIAL_CREATOR_20B" &&
    !ambassador.documents.some((document) => document.documentType === "TAX_20B")
  ) {
    return { ok: false as const, error: "tax_document_required" };
  }
  const accepted = new Set(input.acceptedTypes);
  if (
    AMBASSADOR_LEGAL_DOCUMENTS.some((document) => !accepted.has(document.type))
  ) {
    return { ok: false as const, error: "consents_required" };
  }
  const ipAddressHash = input.ipAddress
    ? hashPrivateValue(input.ipAddress)
    : null;
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    for (const document of AMBASSADOR_LEGAL_DOCUMENTS) {
      await tx.ambassadorConsent.upsert({
        where: {
          ambassadorId_documentType_documentVersion: {
            ambassadorId: ambassador.id,
            documentType: document.type,
            documentVersion: document.version
          }
        },
        create: {
          ambassadorId: ambassador.id,
          documentType: document.type,
          documentVersion: document.version,
          action: document.action,
          ipAddressHash,
          userAgent: (input.userAgent || "").slice(0, 500),
          documentHash: document.hash
        },
        update: {
          action: document.action,
          recordedAt: now,
          ipAddressHash,
          userAgent: (input.userAgent || "").slice(0, 500),
          documentHash: document.hash
        }
      });
    }
    await tx.ambassador.update({
      where: { id: ambassador.id },
      data: {
        status: "REVIEW_PENDING",
        onboardingStep: 5,
        onboardingCompletedAt: now
      }
    });
    await tx.ambassadorInvite.update({
      where: { id: invite.id },
      data: { usedAt: now }
    });
  });
  return { ok: true as const };
}

async function availableCouponCode(firstName: string, lastName: string) {
  for (const candidate of couponCandidates(firstName, lastName)) {
    const exists = await prisma.ambassadorCoupon.findUnique({
      where: { code: candidate },
      select: { id: true }
    });
    if (!exists) return candidate;
  }
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = normalizeAmbassadorCoupon(
      `${firstName}${randomBytes(2).toString("hex")}10`
    );
    const exists = await prisma.ambassadorCoupon.findUnique({
      where: { code: candidate },
      select: { id: true }
    });
    if (!exists) return candidate;
  }
  throw new Error("coupon_generation_failed");
}

export async function reviewAmbassador(input: {
  ambassadorId: string;
  action: "approve" | "missing_documents" | "reject";
  reason?: string;
  couponCode?: string;
  ipAddress?: string;
}) {
  const ambassador = await prisma.ambassador.findUnique({
    where: { id: input.ambassadorId },
    include: { documents: true }
  });
  if (!ambassador) return { ok: false as const, error: "not_found" };
  if (
    !["REVIEW_PENDING", "MISSING_DOCUMENTS"].includes(ambassador.status)
  ) {
    return { ok: false as const, error: "invalid_status" };
  }
  if (input.action !== "approve") {
    const status: AmbassadorStatus =
      input.action === "reject" ? "REJECTED" : "MISSING_DOCUMENTS";
    await prisma.ambassador.update({
      where: { id: ambassador.id },
      data: { status }
    });
    await auditAdminAction({
      action:
        input.action === "reject"
          ? "AMBASSADOR_REJECTED"
          : "AMBASSADOR_MISSING_DOCUMENTS",
      entityType: "Ambassador",
      entityId: ambassador.id,
      ambassadorId: ambassador.id,
      oldValue: { status: ambassador.status },
      newValue: { status, reason: (input.reason || "").slice(0, 500) },
      ipAddress: input.ipAddress
    });
    await sendAmbassadorReviewEmail({
      to: ambassador.email,
      firstName: ambassador.firstName,
      kind:
        input.action === "missing_documents"
          ? "missing_documents"
          : "rejected",
      reason: (input.reason || "").slice(0, 500)
    }).catch(() => undefined);
    return { ok: true as const, status };
  }
  if (!ambassador.taxStatusValid || !ambassador.taxVerifiedAt) {
    return { ok: false as const, error: "tax_not_verified" };
  }
  if (
    ambassador.documents.some((document) => document.status === "PENDING") ||
    ambassador.documents.some((document) => document.status === "REJECTED")
  ) {
    return { ok: false as const, error: "documents_not_approved" };
  }
  const requested = input.couponCode
    ? normalizeAmbassadorCoupon(input.couponCode)
    : "";
  const code =
    requested || (await availableCouponCode(ambassador.firstName, ambassador.lastName));
  if (requested) {
    const exists = await prisma.ambassadorCoupon.findUnique({
      where: { code },
      select: { id: true, ambassadorId: true }
    });
    if (exists && exists.ambassadorId !== ambassador.id) {
      return { ok: false as const, error: "coupon_taken" };
    }
  }
  const referralToken =
    ambassador.referralToken || randomBytes(18).toString("base64url");
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { email: ambassador.email },
      create: {
        email: ambassador.email,
        name: `${ambassador.firstName} ${ambassador.lastName}`,
        phone: ambassador.phone,
        emailVerifiedAt: ambassador.emailVerifiedAt || now
      },
      update: {
        name: `${ambassador.firstName} ${ambassador.lastName}`,
        phone: ambassador.phone,
        emailVerifiedAt: ambassador.emailVerifiedAt || now
      }
    });
    const updated = await tx.ambassador.update({
      where: { id: ambassador.id },
      data: {
        userId: user.id,
        status: "ACTIVE_PENDING_SHIPMENT",
        approvedAt: now,
        activatedAt: now,
        referralToken,
        referralActive: true
      }
    });
    await tx.ambassadorCoupon.upsert({
      where: { code },
      create: {
        ambassadorId: ambassador.id,
        code,
        discountPercent: Number(ambassador.customerDiscountRate) * 100,
        active: true
      },
      update: {
        ambassadorId: ambassador.id,
        discountPercent: Number(ambassador.customerDiscountRate) * 100,
        active: true,
        disabledAt: null
      }
    });
    await tx.ambassadorShipment.create({
      data: {
        ambassadorId: ambassador.id,
        shipmentType: "WELCOME_PACKAGE",
        status: "PENDING"
      }
    });
    return updated;
  });
  await auditAdminAction({
    action: "AMBASSADOR_APPROVED",
    entityType: "Ambassador",
    entityId: ambassador.id,
    ambassadorId: ambassador.id,
    oldValue: { status: ambassador.status },
    newValue: {
      status: result.status,
      couponCode: code,
      referralActive: true
    },
    ipAddress: input.ipAddress
  });
  const origin = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://petiwell.com"
  ).replace(/\/+$/, "");
  await sendAmbassadorApprovedEmail({
    to: ambassador.email,
    firstName: ambassador.firstName,
    couponCode: code,
    referralUrl: `${origin}/r/${referralToken}`
  }).catch(() => undefined);
  return { ok: true as const, ambassador: result, couponCode: code };
}

export function requestIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    ""
  );
}

export function documentTypeFromRaw(raw: string): AmbassadorDocumentType | null {
  const allowed: AmbassadorDocumentType[] = [
    "TAX_20B",
    "TAX_CERTIFICATE",
    "INVOICE_INFO",
    "PAYOUT_INVOICE",
    "CONTENT_DRAFT",
    "OTHER"
  ];
  return allowed.includes(raw as AmbassadorDocumentType)
    ? (raw as AmbassadorDocumentType)
    : null;
}
