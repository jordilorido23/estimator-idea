-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PDF', 'IMAGE', 'DWG', 'OTHER');

-- CreateEnum
CREATE TYPE "TakeoffSourceType" AS ENUM ('PHOTO', 'DOCUMENT', 'HYBRID');

-- AlterTable
ALTER TABLE "Takeoff" ADD COLUMN     "documentIds" TEXT[],
ADD COLUMN     "sourceType" "TakeoffSourceType" NOT NULL DEFAULT 'PHOTO';

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" "DocumentType" NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Document_key_key" ON "Document"("key");

-- CreateIndex
CREATE INDEX "Document_leadId_idx" ON "Document"("leadId");

-- CreateIndex
CREATE INDEX "Document_fileType_idx" ON "Document"("fileType");

-- CreateIndex
CREATE INDEX "Takeoff_sourceType_idx" ON "Takeoff"("sourceType");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
