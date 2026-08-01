-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "autoPostInstagramEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "instagramPostError" TEXT,
ADD COLUMN     "instagramPostId" TEXT,
ADD COLUMN     "instagramPostedAt" TIMESTAMP(3);
