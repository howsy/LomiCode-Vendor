/*
  Warnings:

  - A unique constraint covering the columns `[public_slug]` on the table `tenants` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "brand_color" TEXT,
ADD COLUMN     "logo_url" TEXT,
ADD COLUMN     "public_menu_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "public_slug" TEXT,
ADD COLUMN     "tagline" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "tenants_public_slug_key" ON "tenants"("public_slug");
