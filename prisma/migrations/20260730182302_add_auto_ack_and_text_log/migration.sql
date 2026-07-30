-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "autoAckEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "EmailLog" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'followup';

-- CreateTable
CREATE TABLE "TextLog" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'instant_ack',
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TextLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TextLog_leadId_idx" ON "TextLog"("leadId");

-- AddForeignKey
ALTER TABLE "TextLog" ADD CONSTRAINT "TextLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
