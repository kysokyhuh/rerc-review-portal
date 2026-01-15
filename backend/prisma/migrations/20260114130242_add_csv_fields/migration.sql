-- CreateEnum
CREATE TYPE "ResearchTypePHREB" AS ENUM ('BIOMEDICAL', 'SOCIAL_BEHAVIORAL', 'PUBLIC_HEALTH', 'CLINICAL_TRIAL', 'EPIDEMIOLOGICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ReviewerRoleType" AS ENUM ('SCIENTIST', 'LAY', 'INDEPENDENT_CONSULTANT');

-- CreateEnum
CREATE TYPE "HonorariumStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "WorkflowEventType" AS ENUM ('CLASSIFICATION_DONE', 'DOCUMENTS_TO_REVIEWER', 'ASSESSMENT_FORMS_COMPLETED', 'FULL_REVIEW_MEETING', 'REVIEW_RESULTS_FINALIZED', 'RESULTS_COMMUNICATED', 'RESUBMISSION_RECEIVED', 'RESUBMISSION_REVIEWED', 'RESUBMISSION_FINALIZED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "department" TEXT,
ADD COLUMN     "proponent" TEXT,
ADD COLUMN     "researchTypePHREB" "ResearchTypePHREB",
ADD COLUMN     "researchTypePHREBOther" TEXT;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "honorariumStatus" "HonorariumStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
ADD COLUMN     "reviewerRole" "ReviewerRoleType";

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "remarks" TEXT;

-- CreateTable
CREATE TABLE "WorkflowEvent" (
    "id" SERIAL NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "eventType" "WorkflowEventType" NOT NULL,
    "cycleNumber" INTEGER NOT NULL DEFAULT 1,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "daysFromPrevious" INTEGER,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowEvent_submissionId_eventType_idx" ON "WorkflowEvent"("submissionId", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowEvent_submissionId_eventType_cycleNumber_key" ON "WorkflowEvent"("submissionId", "eventType", "cycleNumber");

-- AddForeignKey
ALTER TABLE "WorkflowEvent" ADD CONSTRAINT "WorkflowEvent_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
