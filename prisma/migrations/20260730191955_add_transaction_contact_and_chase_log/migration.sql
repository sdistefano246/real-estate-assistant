-- CreateTable
CREATE TABLE "TransactionContact" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChaseLog" (
    "id" TEXT NOT NULL,
    "transactionContactId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChaseLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransactionContact_transactionId_idx" ON "TransactionContact"("transactionId");

-- CreateIndex
CREATE INDEX "ChaseLog_transactionContactId_idx" ON "ChaseLog"("transactionContactId");

-- AddForeignKey
ALTER TABLE "TransactionContact" ADD CONSTRAINT "TransactionContact_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChaseLog" ADD CONSTRAINT "ChaseLog_transactionContactId_fkey" FOREIGN KEY ("transactionContactId") REFERENCES "TransactionContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
