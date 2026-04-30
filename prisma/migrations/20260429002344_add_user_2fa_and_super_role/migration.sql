-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'vendor_super';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totp_recovery_codes" JSONB,
ADD COLUMN     "totp_required" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totp_secret" TEXT;
