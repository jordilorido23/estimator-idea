-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'QUALIFIED', 'DECLINED', 'ESTIMATED');

-- CreateEnum
CREATE TYPE "EstimateStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TradeType" AS ENUM ('ROOFING', 'PAINTING', 'FLOORING', 'SIDING', 'BATH', 'KITCHEN', 'DECK', 'FENCE', 'ADDITION', 'OTHER');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ESTIMATOR', 'PM', 'ADMIN');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('DEPOSIT', 'FINAL', 'MILESTONE');

-- CreateEnum
CREATE TYPE "ProjectOutcome" AS ENUM ('WON', 'LOST', 'IN_PROGRESS', 'CANCELLED');

-- CreateTable
CREATE TABLE "Contractor" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "trades" "TradeType"[],
    "depositPercentage" DECIMAL(5,2) NOT NULL DEFAULT 25,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorUser" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractorUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "homeownerName" TEXT NOT NULL,
    "homeownerEmail" TEXT NOT NULL,
    "homeownerPhone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "tradeType" "TradeType" NOT NULL,
    "budgetCents" INTEGER,
    "timeline" TEXT,
    "stripeCustomerId" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "score" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Takeoff" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "tradeType" "TradeType" NOT NULL,
    "provider" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION,
    "reviewedAt" TIMESTAMP(3),
    "accuracyFeedback" JSONB,
    "overallAccuracy" DOUBLE PRECISION,
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Takeoff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estimate" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "lineItems" JSONB NOT NULL,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "margin" DECIMAL(5,2) NOT NULL,
    "contingency" DECIMAL(5,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "confidence" "Confidence" NOT NULL,
    "status" "EstimateStatus" NOT NULL DEFAULT 'DRAFT',
    "proposalUrl" TEXT,
    "publicToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "projectOutcome" "ProjectOutcome",
    "actualCost" DECIMAL(18,2),
    "completedAt" TIMESTAMP(3),
    "feedbackNotes" TEXT,
    "variance" DECIMAL(18,2),
    "variancePercent" DECIMAL(8,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Estimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "tradeType" "TradeType" NOT NULL,
    "name" TEXT NOT NULL,
    "lineItems" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPrice" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "materialSKU" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "stripePaymentId" TEXT,
    "stripeCheckoutId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "type" "PaymentType" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIUsage" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "leadId" TEXT,
    "estimateId" TEXT,
    "operation" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "estimatedCost" DECIMAL(10,6) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contractor_slug_key" ON "Contractor"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Contractor_email_key" ON "Contractor"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ContractorUser_email_key" ON "ContractorUser"("email");

-- CreateIndex
CREATE INDEX "ContractorUser_contractorId_idx" ON "ContractorUser"("contractorId");

-- CreateIndex
CREATE INDEX "Lead_contractorId_createdAt_idx" ON "Lead"("contractorId", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_status_score_idx" ON "Lead"("status", "score");

-- CreateIndex
CREATE INDEX "Lead_tradeType_idx" ON "Lead"("tradeType");

-- CreateIndex
CREATE INDEX "Lead_contractorId_status_createdAt_idx" ON "Lead"("contractorId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Photo_key_key" ON "Photo"("key");

-- CreateIndex
CREATE INDEX "Photo_leadId_idx" ON "Photo"("leadId");

-- CreateIndex
CREATE INDEX "Takeoff_leadId_createdAt_idx" ON "Takeoff"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "Takeoff_reviewedAt_idx" ON "Takeoff"("reviewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Estimate_publicToken_key" ON "Estimate"("publicToken");

-- CreateIndex
CREATE INDEX "Estimate_contractorId_createdAt_idx" ON "Estimate"("contractorId", "createdAt");

-- CreateIndex
CREATE INDEX "Estimate_leadId_idx" ON "Estimate"("leadId");

-- CreateIndex
CREATE INDEX "Estimate_publicToken_idx" ON "Estimate"("publicToken");

-- CreateIndex
CREATE INDEX "Estimate_projectOutcome_completedAt_idx" ON "Estimate"("projectOutcome", "completedAt");

-- CreateIndex
CREATE INDEX "Estimate_status_idx" ON "Estimate"("status");

-- CreateIndex
CREATE INDEX "Estimate_contractorId_status_idx" ON "Estimate"("contractorId", "status");

-- CreateIndex
CREATE INDEX "Template_tradeType_idx" ON "Template"("tradeType");

-- CreateIndex
CREATE INDEX "SupplierPrice_contractorId_updatedAt_idx" ON "SupplierPrice"("contractorId", "updatedAt");

-- CreateIndex
CREATE INDEX "SupplierPrice_materialSKU_idx" ON "SupplierPrice"("materialSKU");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripePaymentId_key" ON "Payment"("stripePaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripeCheckoutId_key" ON "Payment"("stripeCheckoutId");

-- CreateIndex
CREATE INDEX "Payment_estimateId_idx" ON "Payment"("estimateId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "AIUsage_contractorId_createdAt_idx" ON "AIUsage"("contractorId", "createdAt");

-- CreateIndex
CREATE INDEX "AIUsage_leadId_idx" ON "AIUsage"("leadId");

-- CreateIndex
CREATE INDEX "AIUsage_estimateId_idx" ON "AIUsage"("estimateId");

-- CreateIndex
CREATE INDEX "AIUsage_operation_createdAt_idx" ON "AIUsage"("operation", "createdAt");

-- AddForeignKey
ALTER TABLE "ContractorUser" ADD CONSTRAINT "ContractorUser_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Takeoff" ADD CONSTRAINT "Takeoff_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsage" ADD CONSTRAINT "AIUsage_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsage" ADD CONSTRAINT "AIUsage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsage" ADD CONSTRAINT "AIUsage_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
