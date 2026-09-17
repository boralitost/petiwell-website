-- Technical operations, security, refunds and notification support.

CREATE TYPE "AdminRole" AS ENUM (
  'SUPER_ADMIN',
  'OPERATIONS',
  'FINANCE',
  'CONTENT_REVIEW'
);

ALTER TABLE "Order"
  ADD COLUMN "refundedTry" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "productRefundedTry" DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE "OrderItem"
  ADD COLUMN "refundedQuantity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "refundedTry" DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE "Ambassador"
  ADD COLUMN "retentionDeleteAfter" TIMESTAMP(3);

ALTER TABLE "AmbassadorCommissionAdjustment"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING';

CREATE TABLE "RefundAttempt" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "amountTry" DECIMAL(10,2) NOT NULL,
  "productRefundTry" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "paytrResponse" TEXT,
  "createdBy" TEXT NOT NULL DEFAULT 'admin',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "RefundAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AmbassadorNotification" (
  "id" TEXT NOT NULL,
  "ambassadorId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "referenceId" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'sent',
  "error" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AmbassadorNotification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'received',
  "error" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "IntegrationWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminUser" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "AdminRole" NOT NULL DEFAULT 'OPERATIONS',
  "totpSecretEncrypted" TEXT,
  "totpEnabledAt" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminSession" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AdminAuditLog"
  ADD COLUMN "adminUserId" TEXT;

CREATE UNIQUE INDEX "RefundAttempt_idempotencyKey_key"
  ON "RefundAttempt"("idempotencyKey");
CREATE INDEX "RefundAttempt_orderId_createdAt_idx"
  ON "RefundAttempt"("orderId", "createdAt");

CREATE UNIQUE INDEX "AmbassadorNotification_ambassadorId_type_referenceId_key"
  ON "AmbassadorNotification"("ambassadorId", "type", "referenceId");
CREATE INDEX "AmbassadorNotification_type_sentAt_idx"
  ON "AmbassadorNotification"("type", "sentAt");

CREATE UNIQUE INDEX "IntegrationWebhookEvent_provider_externalId_key"
  ON "IntegrationWebhookEvent"("provider", "externalId");
CREATE INDEX "IntegrationWebhookEvent_provider_receivedAt_idx"
  ON "IntegrationWebhookEvent"("provider", "receivedAt");

CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");
CREATE INDEX "AdminSession_adminId_expiresAt_idx"
  ON "AdminSession"("adminId", "expiresAt");
CREATE INDEX "AdminAuditLog_adminUserId_createdAt_idx"
  ON "AdminAuditLog"("adminUserId", "createdAt");

ALTER TABLE "RefundAttempt"
  ADD CONSTRAINT "RefundAttempt_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AmbassadorNotification"
  ADD CONSTRAINT "AmbassadorNotification_ambassadorId_fkey"
  FOREIGN KEY ("ambassadorId") REFERENCES "Ambassador"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminSession"
  ADD CONSTRAINT "AdminSession_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminAuditLog"
  ADD CONSTRAINT "AdminAuditLog_adminUserId_fkey"
  FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
