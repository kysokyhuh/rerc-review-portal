-- CreateEnum
CREATE TYPE "PanelMemberRole" AS ENUM ('CHAIR', 'MEMBER', 'SECRETARIAT');

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "continuingReviewDueDate" TIMESTAMP(3),
ADD COLUMN     "finalReportDueDate" TIMESTAMP(3),
ADD COLUMN     "revisionDueDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PanelMember" (
    "id" SERIAL NOT NULL,
    "panelId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "PanelMemberRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PanelMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PanelMember_panelId_userId_key" ON "PanelMember"("panelId", "userId");

-- CreateIndex
CREATE INDEX "Review_submissionId_idx" ON "Review"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_submissionId_reviewerId_key" ON "Review"("submissionId", "reviewerId");

-- CreateIndex
CREATE INDEX "Submission_projectId_submissionType_idx" ON "Submission"("projectId", "submissionType");

-- AddForeignKey
ALTER TABLE "PanelMember" ADD CONSTRAINT "PanelMember_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanelMember" ADD CONSTRAINT "PanelMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
