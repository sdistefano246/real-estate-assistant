-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_resetToken_key" ON "Agent"("resetToken");
