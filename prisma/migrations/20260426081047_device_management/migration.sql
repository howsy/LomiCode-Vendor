-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "max_devices" INTEGER NOT NULL DEFAULT 1;
