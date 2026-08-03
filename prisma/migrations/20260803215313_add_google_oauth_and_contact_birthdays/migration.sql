-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "googleAccessToken" TEXT,
ADD COLUMN     "googleContactsSyncedAt" TIMESTAMP(3),
ADD COLUMN     "googleEmail" TEXT,
ADD COLUMN     "googleRefreshToken" TEXT,
ADD COLUMN     "googleTokenExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "birthdayDay" INTEGER,
ADD COLUMN     "birthdayMonth" INTEGER,
ADD COLUMN     "birthdayYear" INTEGER,
ADD COLUMN     "googleContactResourceName" TEXT;
