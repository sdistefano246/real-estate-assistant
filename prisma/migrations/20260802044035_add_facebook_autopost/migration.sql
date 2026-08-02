-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "autoPostFacebookEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "facebookPostError" TEXT,
ADD COLUMN     "facebookPostId" TEXT,
ADD COLUMN     "facebookPostedAt" TIMESTAMP(3);
