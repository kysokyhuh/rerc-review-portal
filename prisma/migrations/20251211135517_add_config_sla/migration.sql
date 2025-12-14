-- CreateEnum
CREATE TYPE "SLAStage" AS ENUM ('CLASSIFICATION', 'REVIEW', 'REVISION_RESPONSE', 'CONTINUING_REVIEW_DUE', 'FINAL_REPORT_DUE');

-- CreateTable
CREATE TABLE "ConfigSLA" (
    "id" SERIAL NOT NULL,
    "committeeId" INTEGER NOT NULL,
    "reviewType" "ReviewType",
    "stage" "SLAStage" NOT NULL,
    "workingDays" INTEGER NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigSLA_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ConfigSLA" ADD CONSTRAINT "ConfigSLA_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
