-- AlterTable
ALTER TABLE "Order" ADD COLUMN "privacyAccepted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "consumerLegalVersion" TEXT;
ALTER TABLE "Order" ADD COLUMN "consumerLegalHash" TEXT;
