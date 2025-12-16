-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('RECEIVED', 'UNDER_COMPLETENESS_CHECK', 'AWAITING_CLASSIFICATION', 'UNDER_CLASSIFICATION', 'CLASSIFIED', 'UNDER_REVIEW', 'AWAITING_REVISIONS', 'REVISION_SUBMITTED', 'CLOSED', 'WITHDRAWN');

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "status" "SubmissionStatus" NOT NULL DEFAULT 'RECEIVED';

-- CreateTable
CREATE TABLE "SubmissionStatusHistory" (
    "id" SERIAL NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "oldStatus" "SubmissionStatus",
    "newStatus" "SubmissionStatus" NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "changedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionStatusHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SubmissionStatusHistory" ADD CONSTRAINT "SubmissionStatusHistory_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionStatusHistory" ADD CONSTRAINT "SubmissionStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
