-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "dailyDigestEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "autoNurtureEnabled" BOOLEAN NOT NULL DEFAULT false;
