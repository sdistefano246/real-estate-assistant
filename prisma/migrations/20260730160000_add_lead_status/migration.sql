-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'new';

-- CreateIndex
CREATE INDEX "Lead_agentId_status_idx" ON "Lead"("agentId", "status");
