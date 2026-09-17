-- AlterTable
ALTER TABLE "Order" ADD COLUMN "paidEmailSentAt" TIMESTAMP(3);

-- Existing paid orders without a recorded email error already had a confirmation sent.
UPDATE "Order" AS o
SET "paidEmailSentAt" = COALESCE(
  (
    SELECT MIN(p."callbackAt")
    FROM "PaymentAttempt" p
    WHERE p."orderId" = o."id"
      AND p."status" = 'success'
  ),
  o."updatedAt"
)
WHERE o."paymentStatus" = 'success'
  AND o."paidEmailSentAt" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "PaymentAttempt" p
    WHERE p."orderId" = o."id"
      AND p."errorMessage" LIKE '%email:%'
  );
