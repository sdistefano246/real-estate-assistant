-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "calendarToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Agent_calendarToken_key" ON "Agent"("calendarToken");
