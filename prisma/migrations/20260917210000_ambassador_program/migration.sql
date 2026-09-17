-- CreateEnum
CREATE TYPE "AmbassadorStatus" AS ENUM ('INVITED', 'ONBOARDING', 'REVIEW_PENDING', 'MISSING_DOCUMENTS', 'REJECTED', 'ACTIVE_PENDING_SHIPMENT', 'ACTIVE_PENDING_FIRST_CONTENT', 'ACTIVE', 'FINAL_CONTENT_WARNING', 'PAUSED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "AmbassadorTaxType" AS ENUM ('SOCIAL_CREATOR_20B', 'BUSINESS_INVOICE');

-- CreateEnum
CREATE TYPE "AmbassadorDocumentType" AS ENUM ('TAX_20B', 'TAX_CERTIFICATE', 'INVOICE_INFO', 'PAYOUT_INVOICE', 'CONTENT_DRAFT', 'OTHER');

-- CreateEnum
CREATE TYPE "AmbassadorDocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AmbassadorConsentType" AS ENUM ('AMBASSADOR_AGREEMENT', 'KVKK_NOTICE', 'CONTENT_RULES', 'CLAIMS_GUIDE', 'COMMISSION_RULES');

-- CreateEnum
CREATE TYPE "AmbassadorConsentAction" AS ENUM ('ACCEPTED', 'ACKNOWLEDGED');

-- CreateEnum
CREATE TYPE "AmbassadorAttributionType" AS ENUM ('MANUAL_COUPON', 'REFERRAL', 'NONE');

-- CreateEnum
CREATE TYPE "AmbassadorCommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'CANCELLED', 'PAID', 'ADJUSTED', 'UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "AmbassadorAdjustmentReason" AS ENUM ('PARTIAL_REFUND', 'FULL_REFUND_AFTER_PAYOUT', 'MANUAL_CORRECTION', 'SYSTEM_ERROR');

-- CreateEnum
CREATE TYPE "AmbassadorPayoutStatus" AS ENUM ('DRAFT', 'WAITING_DOCUMENT', 'READY', 'PAID', 'FAILED', 'HELD');

-- CreateEnum
CREATE TYPE "AmbassadorShipmentType" AS ENUM ('WELCOME_PACKAGE', 'PRODUCT_RESEND', 'OTHER');

-- CreateEnum
CREATE TYPE "AmbassadorShipmentStatus" AS ENUM ('PENDING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AmbassadorContentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CHANGES_REQUESTED', 'APPROVED', 'PUBLISHED', 'REMOVAL_REQUESTED', 'REMOVED');

-- CreateEnum
CREATE TYPE "AmbassadorFraudType" AS ENUM ('SELF_PURCHASE', 'REPEATED_ADDRESS', 'REPEATED_PAYMENT_METHOD', 'ABNORMAL_REFUND_RATE', 'COUPON_SITE_LEAK', 'SUSPICIOUS_ORDER_PATTERN');

-- CreateEnum
CREATE TYPE "AmbassadorFraudSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "AmbassadorFraudStatus" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "ambassadorCouponId" TEXT,
ADD COLUMN     "ambassadorDiscountTry" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "ambassadorId" TEXT,
ADD COLUMN     "ambassadorReferralId" TEXT,
ADD COLUMN     "attributionSource" TEXT,
ADD COLUMN     "attributionType" "AmbassadorAttributionType" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "campaignDiscountTry" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "commissionRateSnapshot" DECIMAL(5,4) NOT NULL DEFAULT 0,
ADD COLUMN     "customerDiscountRateSnapshot" DECIMAL(5,4) NOT NULL DEFAULT 0,
ADD COLUMN     "productNetExVatTry" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "productTotalAfterDiscountTry" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "vatRateSnapshot" DECIMAL(5,2) NOT NULL DEFAULT 20;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "ambassadorDiscountTry" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "campaignDiscountTry" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "finalProductTotalTry" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "netProductTry" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "vatRateSnapshot" DECIMAL(5,2) NOT NULL DEFAULT 20;

-- CreateTable
CREATE TABLE "AmbassadorInvite" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "socialHandle" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmbassadorInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ambassador" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "userId" TEXT,
    "inviteId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "phone" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "shippingAddress" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT 'TR',
    "status" "AmbassadorStatus" NOT NULL DEFAULT 'ONBOARDING',
    "onboardingStep" INTEGER NOT NULL DEFAULT 1,
    "primarySocialPlatform" TEXT NOT NULL DEFAULT '',
    "instagramUsername" TEXT NOT NULL DEFAULT '',
    "tiktokUsername" TEXT NOT NULL DEFAULT '',
    "youtubeUsername" TEXT NOT NULL DEFAULT '',
    "otherSocialUrl" TEXT NOT NULL DEFAULT '',
    "taxType" "AmbassadorTaxType",
    "taxIdEncrypted" TEXT,
    "taxIdLast4" TEXT,
    "taxOffice" TEXT,
    "businessName" TEXT,
    "invoiceAddress" TEXT,
    "taxStatusValid" BOOLEAN NOT NULL DEFAULT false,
    "taxVerifiedAt" TIMESTAMP(3),
    "ibanEncrypted" TEXT,
    "ibanLast4" TEXT,
    "ibanHolderName" TEXT,
    "bankOwnershipConfirmedAt" TIMESTAMP(3),
    "referralToken" TEXT,
    "referralActive" BOOLEAN NOT NULL DEFAULT false,
    "commissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0.15,
    "customerDiscountRate" DECIMAL(5,4) NOT NULL DEFAULT 0.10,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "onboardingStartedAt" TIMESTAMP(3),
    "onboardingCompletedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "terminatedAt" TIMESTAMP(3),
    "terminationRequestedAt" TIMESTAMP(3),
    "terminationEffectiveAt" TIMESTAMP(3),
    "firstContentDueAt" TIMESTAMP(3),
    "firstContentFinalDueAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ambassador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmbassadorDocument" (
    "id" TEXT NOT NULL,
    "ambassadorId" TEXT NOT NULL,
    "documentType" "AmbassadorDocumentType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "scanStatus" TEXT NOT NULL DEFAULT 'CLEAN',
    "status" "AmbassadorDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "rejectionReason" TEXT,

    CONSTRAINT "AmbassadorDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmbassadorConsent" (
    "id" TEXT NOT NULL,
    "ambassadorId" TEXT NOT NULL,
    "documentType" "AmbassadorConsentType" NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "action" "AmbassadorConsentAction" NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddressHash" TEXT,
    "userAgent" TEXT,
    "documentHash" TEXT NOT NULL,

    CONSTRAINT "AmbassadorConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmbassadorCoupon" (
    "id" TEXT NOT NULL,
    "ambassadorId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMP(3),

    CONSTRAINT "AmbassadorCoupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmbassadorReferral" (
    "id" TEXT NOT NULL,
    "ambassadorId" TEXT NOT NULL,
    "anonymousVisitorHash" TEXT NOT NULL,
    "referralToken" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'link',
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmbassadorReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmbassadorCommission" (
    "id" TEXT NOT NULL,
    "ambassadorId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "grossProductAmount" DECIMAL(10,2) NOT NULL,
    "discountedProductAmount" DECIMAL(10,2) NOT NULL,
    "netProductAmountExVat" DECIMAL(10,2) NOT NULL,
    "commissionRate" DECIMAL(5,4) NOT NULL,
    "commissionAmount" DECIMAL(10,2) NOT NULL,
    "status" "AmbassadorCommissionStatus" NOT NULL DEFAULT 'PENDING',
    "eligibleAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "payoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmbassadorCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmbassadorCommissionAdjustment" (
    "id" TEXT NOT NULL,
    "ambassadorId" TEXT NOT NULL,
    "commissionId" TEXT NOT NULL,
    "payoutId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" "AmbassadorAdjustmentReason" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmbassadorCommissionAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmbassadorPayout" (
    "id" TEXT NOT NULL,
    "ambassadorId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "cutoffAt" TIMESTAMP(3) NOT NULL,
    "approvedCommissionTotal" DECIMAL(10,2) NOT NULL,
    "adjustmentsTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "netPayout" DECIMAL(10,2) NOT NULL,
    "status" "AmbassadorPayoutStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "bankReference" TEXT,
    "invoiceDocumentId" TEXT,
    "invoiceVerifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmbassadorPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmbassadorPayoutDispute" (
    "id" TEXT NOT NULL,
    "ambassadorId" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "orderNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,

    CONSTRAINT "AmbassadorPayoutDispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmbassadorShipment" (
    "id" TEXT NOT NULL,
    "ambassadorId" TEXT NOT NULL,
    "shipmentType" "AmbassadorShipmentType" NOT NULL DEFAULT 'WELCOME_PACKAGE',
    "carrier" TEXT NOT NULL DEFAULT '',
    "trackingNumber" TEXT NOT NULL DEFAULT '',
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "status" "AmbassadorShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmbassadorShipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmbassadorContent" (
    "id" TEXT NOT NULL,
    "ambassadorId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "draftStorageKey" TEXT,
    "publishedUrl" TEXT,
    "captionText" TEXT,
    "status" "AmbassadorContentStatus" NOT NULL DEFAULT 'DRAFT',
    "isFirstContent" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "correctionDueAt" TIMESTAMP(3),
    "urgentRemovalDueAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "productVisible" BOOLEAN,
    "disclosurePresent" BOOLEAN,
    "couponVisible" BOOLEAN,
    "petiwellTagged" BOOLEAN,
    "healthClaimsOk" BOOLEAN,
    "productInfoOk" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmbassadorContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmbassadorFraudFlag" (
    "id" TEXT NOT NULL,
    "ambassadorId" TEXT NOT NULL,
    "orderId" TEXT,
    "type" "AmbassadorFraudType" NOT NULL,
    "severity" "AmbassadorFraudSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "AmbassadorFraudStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,

    CONSTRAINT "AmbassadorFraudFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmbassadorAdminNote" (
    "id" TEXT NOT NULL,
    "ambassadorId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmbassadorAdminNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL DEFAULT 'admin',
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "ambassadorId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddressHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AmbassadorInvite_tokenHash_key" ON "AmbassadorInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "AmbassadorInvite_email_createdAt_idx" ON "AmbassadorInvite"("email", "createdAt");

-- CreateIndex
CREATE INDEX "AmbassadorInvite_expiresAt_idx" ON "AmbassadorInvite"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Ambassador_publicId_key" ON "Ambassador"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Ambassador_userId_key" ON "Ambassador"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Ambassador_inviteId_key" ON "Ambassador"("inviteId");

-- CreateIndex
CREATE UNIQUE INDEX "Ambassador_email_key" ON "Ambassador"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Ambassador_referralToken_key" ON "Ambassador"("referralToken");

-- CreateIndex
CREATE INDEX "Ambassador_status_createdAt_idx" ON "Ambassador"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Ambassador_email_idx" ON "Ambassador"("email");

-- CreateIndex
CREATE INDEX "AmbassadorDocument_ambassadorId_documentType_idx" ON "AmbassadorDocument"("ambassadorId", "documentType");

-- CreateIndex
CREATE INDEX "AmbassadorConsent_ambassadorId_recordedAt_idx" ON "AmbassadorConsent"("ambassadorId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AmbassadorConsent_ambassadorId_documentType_documentVersion_key" ON "AmbassadorConsent"("ambassadorId", "documentType", "documentVersion");

-- CreateIndex
CREATE UNIQUE INDEX "AmbassadorCoupon_code_key" ON "AmbassadorCoupon"("code");

-- CreateIndex
CREATE INDEX "AmbassadorCoupon_ambassadorId_active_idx" ON "AmbassadorCoupon"("ambassadorId", "active");

-- CreateIndex
CREATE INDEX "AmbassadorReferral_anonymousVisitorHash_expiresAt_idx" ON "AmbassadorReferral"("anonymousVisitorHash", "expiresAt");

-- CreateIndex
CREATE INDEX "AmbassadorReferral_ambassadorId_clickedAt_idx" ON "AmbassadorReferral"("ambassadorId", "clickedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AmbassadorCommission_orderId_key" ON "AmbassadorCommission"("orderId");

-- CreateIndex
CREATE INDEX "AmbassadorCommission_ambassadorId_status_idx" ON "AmbassadorCommission"("ambassadorId", "status");

-- CreateIndex
CREATE INDEX "AmbassadorCommission_eligibleAt_status_idx" ON "AmbassadorCommission"("eligibleAt", "status");

-- CreateIndex
CREATE INDEX "AmbassadorCommission_payoutId_idx" ON "AmbassadorCommission"("payoutId");

-- CreateIndex
CREATE INDEX "AmbassadorCommissionAdjustment_ambassadorId_createdAt_idx" ON "AmbassadorCommissionAdjustment"("ambassadorId", "createdAt");

-- CreateIndex
CREATE INDEX "AmbassadorCommissionAdjustment_commissionId_idx" ON "AmbassadorCommissionAdjustment"("commissionId");

-- CreateIndex
CREATE INDEX "AmbassadorCommissionAdjustment_payoutId_idx" ON "AmbassadorCommissionAdjustment"("payoutId");

-- CreateIndex
CREATE INDEX "AmbassadorPayout_ambassadorId_status_idx" ON "AmbassadorPayout"("ambassadorId", "status");

-- CreateIndex
CREATE INDEX "AmbassadorPayout_scheduledFor_status_idx" ON "AmbassadorPayout"("scheduledFor", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AmbassadorPayout_ambassadorId_periodStart_periodEnd_key" ON "AmbassadorPayout"("ambassadorId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "AmbassadorPayoutDispute_payoutId_createdAt_idx" ON "AmbassadorPayoutDispute"("payoutId", "createdAt");

-- CreateIndex
CREATE INDEX "AmbassadorShipment_ambassadorId_status_idx" ON "AmbassadorShipment"("ambassadorId", "status");

-- CreateIndex
CREATE INDEX "AmbassadorContent_ambassadorId_status_idx" ON "AmbassadorContent"("ambassadorId", "status");

-- CreateIndex
CREATE INDEX "AmbassadorContent_status_correctionDueAt_idx" ON "AmbassadorContent"("status", "correctionDueAt");

-- CreateIndex
CREATE INDEX "AmbassadorFraudFlag_ambassadorId_status_idx" ON "AmbassadorFraudFlag"("ambassadorId", "status");

-- CreateIndex
CREATE INDEX "AmbassadorFraudFlag_orderId_idx" ON "AmbassadorFraudFlag"("orderId");

-- CreateIndex
CREATE INDEX "AmbassadorAdminNote_ambassadorId_createdAt_idx" ON "AmbassadorAdminNote"("ambassadorId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_entityType_entityId_createdAt_idx" ON "AdminAuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_ambassadorId_createdAt_idx" ON "AdminAuditLog"("ambassadorId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_ambassadorId_idx" ON "Order"("ambassadorId");

-- CreateIndex
CREATE INDEX "Order_ambassadorCouponId_idx" ON "Order"("ambassadorCouponId");

-- CreateIndex
CREATE INDEX "Order_ambassadorReferralId_idx" ON "Order"("ambassadorReferralId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_ambassadorId_fkey" FOREIGN KEY ("ambassadorId") REFERENCES "Ambassador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_ambassadorCouponId_fkey" FOREIGN KEY ("ambassadorCouponId") REFERENCES "AmbassadorCoupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_ambassadorReferralId_fkey" FOREIGN KEY ("ambassadorReferralId") REFERENCES "AmbassadorReferral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ambassador" ADD CONSTRAINT "Ambassador_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ambassador" ADD CONSTRAINT "Ambassador_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "AmbassadorInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmbassadorDocument" ADD CONSTRAINT "AmbassadorDocument_ambassadorId_fkey" FOREIGN KEY ("ambassadorId") REFERENCES "Ambassador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmbassadorConsent" ADD CONSTRAINT "AmbassadorConsent_ambassadorId_fkey" FOREIGN KEY ("ambassadorId") REFERENCES "Ambassador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmbassadorCoupon" ADD CONSTRAINT "AmbassadorCoupon_ambassadorId_fkey" FOREIGN KEY ("ambassadorId") REFERENCES "Ambassador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmbassadorReferral" ADD CONSTRAINT "AmbassadorReferral_ambassadorId_fkey" FOREIGN KEY ("ambassadorId") REFERENCES "Ambassador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmbassadorCommission" ADD CONSTRAINT "AmbassadorCommission_ambassadorId_fkey" FOREIGN KEY ("ambassadorId") REFERENCES "Ambassador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmbassadorCommission" ADD CONSTRAINT "AmbassadorCommission_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmbassadorCommission" ADD CONSTRAINT "AmbassadorCommission_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "AmbassadorPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmbassadorCommissionAdjustment" ADD CONSTRAINT "AmbassadorCommissionAdjustment_ambassadorId_fkey" FOREIGN KEY ("ambassadorId") REFERENCES "Ambassador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmbassadorCommissionAdjustment" ADD CONSTRAINT "AmbassadorCommissionAdjustment_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "AmbassadorCommission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmbassadorCommissionAdjustment" ADD CONSTRAINT "AmbassadorCommissionAdjustment_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "AmbassadorPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmbassadorPayout" ADD CONSTRAINT "AmbassadorPayout_ambassadorId_fkey" FOREIGN KEY ("ambassadorId") REFERENCES "Ambassador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmbassadorPayoutDispute" ADD CONSTRAINT "AmbassadorPayoutDispute_ambassadorId_fkey" FOREIGN KEY ("ambassadorId") REFERENCES "Ambassador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmbassadorPayoutDispute" ADD CONSTRAINT "AmbassadorPayoutDispute_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "AmbassadorPayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmbassadorShipment" ADD CONSTRAINT "AmbassadorShipment_ambassadorId_fkey" FOREIGN KEY ("ambassadorId") REFERENCES "Ambassador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmbassadorContent" ADD CONSTRAINT "AmbassadorContent_ambassadorId_fkey" FOREIGN KEY ("ambassadorId") REFERENCES "Ambassador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmbassadorFraudFlag" ADD CONSTRAINT "AmbassadorFraudFlag_ambassadorId_fkey" FOREIGN KEY ("ambassadorId") REFERENCES "Ambassador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmbassadorAdminNote" ADD CONSTRAINT "AmbassadorAdminNote_ambassadorId_fkey" FOREIGN KEY ("ambassadorId") REFERENCES "Ambassador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_ambassadorId_fkey" FOREIGN KEY ("ambassadorId") REFERENCES "Ambassador"("id") ON DELETE SET NULL ON UPDATE CASCADE;
