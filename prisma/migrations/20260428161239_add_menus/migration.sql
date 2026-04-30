-- AlterTable
ALTER TABLE "items" ADD COLUMN     "menu_id" TEXT;

-- CreateTable
CREATE TABLE "menus" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "name_ku" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "menus_tenant_id_branch_id_idx" ON "menus"("tenant_id", "branch_id");

-- CreateIndex
CREATE INDEX "menus_tenant_id_branch_id_is_active_idx" ON "menus"("tenant_id", "branch_id", "is_active");

-- CreateIndex
CREATE INDEX "items_tenant_id_menu_id_idx" ON "items"("tenant_id", "menu_id");

-- AddForeignKey
ALTER TABLE "menus" ADD CONSTRAINT "menus_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
