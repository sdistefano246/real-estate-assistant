-- CreateTable
CREATE TABLE "ContactTouch" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactTouch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactTouch_contactId_idx" ON "ContactTouch"("contactId");

-- AddForeignKey
ALTER TABLE "ContactTouch" ADD CONSTRAINT "ContactTouch_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
