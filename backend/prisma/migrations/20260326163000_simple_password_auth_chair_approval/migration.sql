-- AlterEnum
BEGIN;
CREATE TYPE "UserStatus_new" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DISABLED');
ALTER TABLE "public"."User" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "status" TYPE "UserStatus_new" USING (
    CASE
        WHEN "status"::text = 'ACTIVE' AND "isActive" = false AND "passwordHash" IS NOT NULL THEN 'DISABLED'
        WHEN "status"::text = 'ACTIVE' THEN 'APPROVED'
        ELSE "status"::text
    END::"UserStatus_new"
);
ALTER TYPE "UserStatus" RENAME TO "UserStatus_old";
ALTER TYPE "UserStatus_new" RENAME TO "UserStatus";
DROP TYPE "public"."UserStatus_old";
ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropIndex
DROP INDEX "AuditLog_actorId_idx";

-- DropIndex
DROP INDEX "AuditLog_createdAt_idx";

-- DropIndex
DROP INDEX "AuditLog_entityType_entityId_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" INTEGER,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedById" INTEGER;

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
    "idleExpiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "lastReauthenticatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthSession_userId_createdAt_idx" ON "AuthSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_absoluteExpiresAt_idx" ON "AuthSession"("absoluteExpiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_idleExpiresAt_idx" ON "AuthSession"("idleExpiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_revokedAt_idx" ON "AuthSession"("revokedAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "Classification_panelId_idx" ON "Classification"("panelId");

-- CreateIndex
CREATE INDEX "Classification_classifiedById_idx" ON "Classification"("classifiedById");

-- CreateIndex
CREATE INDEX "ClassificationDecision_committeeId_idx" ON "ClassificationDecision"("committeeId");

-- CreateIndex
CREATE INDEX "ClassificationDecision_recordedById_idx" ON "ClassificationDecision"("recordedById");

-- CreateIndex
CREATE INDEX "ClassificationVote_classificationDecisionId_idx" ON "ClassificationVote"("classificationDecisionId");

-- CreateIndex
CREATE INDEX "CommitteeMember_userId_idx" ON "CommitteeMember"("userId");

-- CreateIndex
CREATE INDEX "ConfigSLA_committeeId_idx" ON "ConfigSLA"("committeeId");

-- CreateIndex
CREATE INDEX "ContractPeriod_committeeId_idx" ON "ContractPeriod"("committeeId");

-- CreateIndex
CREATE INDEX "LetterDraft_generatedById_idx" ON "LetterDraft"("generatedById");

-- CreateIndex
CREATE INDEX "LetterDraft_approvedById_idx" ON "LetterDraft"("approvedById");

-- CreateIndex
CREATE INDEX "Panel_committeeId_idx" ON "Panel"("committeeId");

-- CreateIndex
CREATE INDEX "PanelMember_userId_idx" ON "PanelMember"("userId");

-- CreateIndex
CREATE INDEX "Project_committeeId_idx" ON "Project"("committeeId");

-- CreateIndex
CREATE INDEX "Project_createdById_idx" ON "Project"("createdById");

-- CreateIndex
CREATE INDEX "ProjectChangeLog_sourceSubmissionId_idx" ON "ProjectChangeLog"("sourceSubmissionId");

-- CreateIndex
CREATE INDEX "ProjectChangeLog_changedById_idx" ON "ProjectChangeLog"("changedById");

-- CreateIndex
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");

-- CreateIndex
CREATE INDEX "ProjectProponent_proponentId_idx" ON "ProjectProponent"("proponentId");

-- CreateIndex
CREATE INDEX "ProjectSnapshot_changedById_idx" ON "ProjectSnapshot"("changedById");

-- CreateIndex
CREATE INDEX "ProjectStatusHistory_changedById_idx" ON "ProjectStatusHistory"("changedById");

-- CreateIndex
CREATE INDEX "Review_reviewerId_idx" ON "Review"("reviewerId");

-- CreateIndex
CREATE INDEX "Submission_createdById_idx" ON "Submission"("createdById");

-- CreateIndex
CREATE INDEX "Submission_staffInChargeId_idx" ON "Submission"("staffInChargeId");

-- CreateIndex
CREATE INDEX "SubmissionChangeLog_changedById_idx" ON "SubmissionChangeLog"("changedById");

-- CreateIndex
CREATE INDEX "SubmissionStatusHistory_submissionId_idx" ON "SubmissionStatusHistory"("submissionId");

-- CreateIndex
CREATE INDEX "SubmissionStatusHistory_changedById_idx" ON "SubmissionStatusHistory"("changedById");

-- CreateIndex
CREATE INDEX "User_approvedById_idx" ON "User"("approvedById");

-- CreateIndex
CREATE INDEX "User_rejectedById_idx" ON "User"("rejectedById");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
