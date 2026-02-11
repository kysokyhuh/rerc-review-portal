/*
  Warnings:

  - A unique constraint covering the columns `[projectId,sequenceNumber]` on the table `Submission` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "EndorsementStatus" AS ENUM ('PENDING', 'RECEIVED', 'WAIVED', 'NOT_REQUIRED');

-- CreateEnum
CREATE TYPE "ProjectMemberRole" AS ENUM ('PI', 'CO_PI', 'CO_INVESTIGATOR', 'RESEARCH_ASSISTANT', 'STATISTICIAN', 'OTHER');

-- CreateEnum
CREATE TYPE "SubmissionDocumentType" AS ENUM ('INFORMED_CONSENT', 'DATA_GATHERING_INSTRUMENT', 'MATERIAL_TRANSFER_AGREEMENT', 'PERMISSION_LETTER', 'OTHER');

-- CreateEnum
CREATE TYPE "SubmissionDocumentStatus" AS ENUM ('MISSING', 'PENDING', 'RECEIVED', 'REVIEWED');

-- CreateEnum
CREATE TYPE "LetterDraftStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT');

-- CreateEnum
CREATE TYPE "ClassificationType" AS ENUM ('EXEMPT', 'EXPEDITED', 'FULL_BOARD');

-- CreateEnum
CREATE TYPE "ReviewerRoundRole" AS ENUM ('SCIENTIFIC', 'LAY');

-- CreateEnum
CREATE TYPE "DecisionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- AlterEnum
ALTER TYPE "SubmissionType" ADD VALUE 'RESUBMISSION';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorkflowEventType" ADD VALUE 'APPLICATION_SUBMITTED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'PANEL_ASSIGNED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'REVIEWERS_ASSIGNED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'REVIEW_SUBMITTED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'DECISION_ISSUED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'CONTINUING_REVIEW_DUE';
ALTER TYPE "WorkflowEventType" ADD VALUE 'FINAL_REPORT_DUE';

-- DropForeignKey
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_projectId_fkey";

-- AlterTable
ALTER TABLE "Classification" ADD COLUMN     "clarificationsNeeded" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "missingDocuments" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "piSurname" TEXT,
ADD COLUMN     "proposedEndDate" TIMESTAMP(3),
ADD COLUMN     "proposedStartDate" TIMESTAMP(3),
ALTER COLUMN "projectCode" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "endorsementReceivedAt" TIMESTAMP(3),
ADD COLUMN     "endorsementStatus" "EndorsementStatus",
ADD COLUMN     "receivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "staffInChargeId" INTEGER,
ALTER COLUMN "projectId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isCommonReviewer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "lastLoginIp" TEXT,
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "passwordResetExpiresAt" TIMESTAMP(3),
ADD COLUMN     "passwordResetToken" TEXT,
ADD COLUMN     "reviewerExpertise" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "Proponent" (
    "id" SERIAL NOT NULL,
    "printedName" TEXT NOT NULL,
    "signature" TEXT,
    "email" TEXT,
    "affiliation" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectProponent" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "proponentId" INTEGER NOT NULL,
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectProponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "ProjectMemberRole" NOT NULL,
    "email" TEXT,
    "affiliation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectChangeLog" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "fieldName" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "sourceSubmissionId" INTEGER,
    "changedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectSnapshot" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "projectCode" TEXT,
    "title" TEXT NOT NULL,
    "piName" TEXT NOT NULL,
    "piSurname" TEXT,
    "piAffiliation" TEXT,
    "department" TEXT,
    "proponent" TEXT,
    "fundingType" "FundingType" NOT NULL,
    "researchTypePHREB" "ResearchTypePHREB",
    "researchTypePHREBOther" TEXT,
    "initialSubmissionDate" TIMESTAMP(3),
    "proposedStartDate" TIMESTAMP(3),
    "proposedEndDate" TIMESTAMP(3),
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "reason" TEXT,
    "changedById" INTEGER,

    CONSTRAINT "ProjectSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionChangeLog" (
    "id" SERIAL NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "fieldName" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "changedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassificationDecision" (
    "id" SERIAL NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "committeeId" INTEGER NOT NULL,
    "classification" "ClassificationType" NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" INTEGER,
    "notes" TEXT,

    CONSTRAINT "ClassificationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassificationVote" (
    "id" SERIAL NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "committeeMemberId" INTEGER NOT NULL,
    "classification" "ClassificationType" NOT NULL,
    "votedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remarks" TEXT,
    "classificationDecisionId" INTEGER,

    CONSTRAINT "ClassificationVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectStatusHistory" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "oldStatus" "ProjectStatus",
    "newStatus" "ProjectStatus" NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "changedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewAssignment" (
    "id" SERIAL NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "roundSequence" INTEGER NOT NULL DEFAULT 1,
    "reviewerId" INTEGER NOT NULL,
    "reviewerRole" "ReviewerRoundRole" NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "decision" "ReviewDecision",
    "endorsementStatus" "EndorsementStatus",
    "remarks" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "ReviewAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionDocument" (
    "id" SERIAL NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "type" "SubmissionDocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "status" "SubmissionDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "documentUrl" TEXT,
    "notes" TEXT,
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubmissionDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionDecision" (
    "id" SERIAL NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "decision" "ReviewDecision" NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "status" "DecisionStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,

    CONSTRAINT "SubmissionDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LetterDraft" (
    "id" SERIAL NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "templateCode" TEXT NOT NULL,
    "status" "LetterDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "content" JSONB,
    "fileUrl" TEXT,
    "notes" TEXT,
    "generatedById" INTEGER,
    "approvedById" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LetterDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractPeriod" (
    "id" SERIAL NOT NULL,
    "committeeId" INTEGER,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectProponent_projectId_proponentId_key" ON "ProjectProponent"("projectId", "proponentId");

-- CreateIndex
CREATE INDEX "ProjectChangeLog_projectId_idx" ON "ProjectChangeLog"("projectId");

-- CreateIndex
CREATE INDEX "ProjectSnapshot_projectId_idx" ON "ProjectSnapshot"("projectId");

-- CreateIndex
CREATE INDEX "SubmissionChangeLog_submissionId_idx" ON "SubmissionChangeLog"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassificationDecision_submissionId_key" ON "ClassificationDecision"("submissionId");

-- CreateIndex
CREATE INDEX "ClassificationVote_committeeMemberId_idx" ON "ClassificationVote"("committeeMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassificationVote_submissionId_committeeMemberId_key" ON "ClassificationVote"("submissionId", "committeeMemberId");

-- CreateIndex
CREATE INDEX "ProjectStatusHistory_projectId_idx" ON "ProjectStatusHistory"("projectId");

-- CreateIndex
CREATE INDEX "ReviewAssignment_submissionId_roundSequence_idx" ON "ReviewAssignment"("submissionId", "roundSequence");

-- CreateIndex
CREATE INDEX "ReviewAssignment_reviewerId_idx" ON "ReviewAssignment"("reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewAssignment_submissionId_roundSequence_reviewerRole_key" ON "ReviewAssignment"("submissionId", "roundSequence", "reviewerRole");

-- CreateIndex
CREATE INDEX "SubmissionDocument_submissionId_type_idx" ON "SubmissionDocument"("submissionId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionDecision_submissionId_key" ON "SubmissionDecision"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");

-- CreateIndex
CREATE INDEX "LetterDraft_submissionId_status_idx" ON "LetterDraft"("submissionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_projectId_sequenceNumber_key" ON "Submission"("projectId", "sequenceNumber");

-- AddForeignKey
ALTER TABLE "ProjectProponent" ADD CONSTRAINT "ProjectProponent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectProponent" ADD CONSTRAINT "ProjectProponent_proponentId_fkey" FOREIGN KEY ("proponentId") REFERENCES "Proponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectChangeLog" ADD CONSTRAINT "ProjectChangeLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectChangeLog" ADD CONSTRAINT "ProjectChangeLog_sourceSubmissionId_fkey" FOREIGN KEY ("sourceSubmissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectChangeLog" ADD CONSTRAINT "ProjectChangeLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSnapshot" ADD CONSTRAINT "ProjectSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSnapshot" ADD CONSTRAINT "ProjectSnapshot_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_staffInChargeId_fkey" FOREIGN KEY ("staffInChargeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionChangeLog" ADD CONSTRAINT "SubmissionChangeLog_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionChangeLog" ADD CONSTRAINT "SubmissionChangeLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassificationDecision" ADD CONSTRAINT "ClassificationDecision_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassificationDecision" ADD CONSTRAINT "ClassificationDecision_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassificationDecision" ADD CONSTRAINT "ClassificationDecision_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassificationVote" ADD CONSTRAINT "ClassificationVote_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassificationVote" ADD CONSTRAINT "ClassificationVote_committeeMemberId_fkey" FOREIGN KEY ("committeeMemberId") REFERENCES "CommitteeMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassificationVote" ADD CONSTRAINT "ClassificationVote_classificationDecisionId_fkey" FOREIGN KEY ("classificationDecisionId") REFERENCES "ClassificationDecision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStatusHistory" ADD CONSTRAINT "ProjectStatusHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStatusHistory" ADD CONSTRAINT "ProjectStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewAssignment" ADD CONSTRAINT "ReviewAssignment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewAssignment" ADD CONSTRAINT "ReviewAssignment_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionDocument" ADD CONSTRAINT "SubmissionDocument_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionDecision" ADD CONSTRAINT "SubmissionDecision_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LetterDraft" ADD CONSTRAINT "LetterDraft_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LetterDraft" ADD CONSTRAINT "LetterDraft_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LetterDraft" ADD CONSTRAINT "LetterDraft_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractPeriod" ADD CONSTRAINT "ContractPeriod_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
