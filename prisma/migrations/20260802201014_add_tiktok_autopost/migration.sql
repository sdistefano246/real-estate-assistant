-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "autoPostTiktokEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tiktokAccessToken" TEXT,
ADD COLUMN     "tiktokOpenId" TEXT,
ADD COLUMN     "tiktokRefreshToken" TEXT,
ADD COLUMN     "tiktokTokenExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "tiktokPostError" TEXT,
ADD COLUMN     "tiktokPostId" TEXT,
ADD COLUMN     "tiktokPostedAt" TIMESTAMP(3);
