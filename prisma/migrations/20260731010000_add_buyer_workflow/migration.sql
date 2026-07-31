-- CreateTable
CREATE TABLE "Buyer" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "leadId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "locations" TEXT,
    "minPrice" INTEGER,
    "maxPrice" INTEGER,
    "minBeds" INTEGER,
    "minBaths" DOUBLE PRECISION,
    "propertyType" TEXT,
    "mustHaves" TEXT,
    "preApproved" BOOLEAN NOT NULL DEFAULT false,
    "preApprovalAmount" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Buyer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerProperty" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "price" INTEGER,
    "beds" INTEGER,
    "baths" DOUBLE PRECISION,
    "propertyType" TEXT,
    "listingUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'considering',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuyerProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Showing" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "buyerPropertyId" TEXT,
    "address" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Showing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Buyer_agentId_idx" ON "Buyer"("agentId");

-- CreateIndex
CREATE INDEX "Buyer_leadId_idx" ON "Buyer"("leadId");

-- CreateIndex
CREATE INDEX "BuyerProperty_buyerId_idx" ON "BuyerProperty"("buyerId");

-- CreateIndex
CREATE INDEX "Showing_buyerId_idx" ON "Showing"("buyerId");

-- CreateIndex
CREATE INDEX "Showing_buyerPropertyId_idx" ON "Showing"("buyerPropertyId");

-- AddForeignKey
ALTER TABLE "Buyer" ADD CONSTRAINT "Buyer_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Buyer" ADD CONSTRAINT "Buyer_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerProperty" ADD CONSTRAINT "BuyerProperty_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Showing" ADD CONSTRAINT "Showing_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Showing" ADD CONSTRAINT "Showing_buyerPropertyId_fkey" FOREIGN KEY ("buyerPropertyId") REFERENCES "BuyerProperty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
