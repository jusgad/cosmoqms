/*
  Warnings:

  - Added the required column `created_by` to the `sops` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SopStatus" AS ENUM ('borrador', 'vigente', 'obsoleto');

-- AlterEnum
ALTER TYPE "AttachmentEntity" ADD VALUE 'sop';

-- AlterEnum
ALTER TYPE "AttachmentKind" ADD VALUE 'documento';

-- AlterTable
ALTER TABLE "sops" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by" TEXT,
ADD COLUMN     "change_summary" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by" TEXT NOT NULL,
ADD COLUMN     "effective_date" DATE,
ADD COLUMN     "meaning_statement" TEXT,
ADD COLUMN     "obsoleted_at" TIMESTAMP(3),
ADD COLUMN     "review_due" DATE,
ADD COLUMN     "status" "SopStatus" NOT NULL DEFAULT 'borrador',
ALTER COLUMN "file_url" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "sops_tenant_id_status_idx" ON "sops"("tenant_id", "status");
