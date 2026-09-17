-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LoginToken" ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'reset_password';
