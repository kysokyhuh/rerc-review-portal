CREATE TABLE "ProtocolProfile" (
  "id" SERIAL NOT NULL,
  "projectId" INTEGER NOT NULL,
  "title" TEXT,
  "projectLeader" TEXT,
  "college" TEXT,
  "department" TEXT,
  "dateOfSubmission" TIMESTAMP(3),
  "monthOfSubmission" TEXT,
  "typeOfReview" TEXT,
  "proponent" TEXT,
  "funding" TEXT,
  "typeOfResearchPhreb" TEXT,
  "typeOfResearchPhrebOther" TEXT,
  "status" TEXT,
  "finishDate" TIMESTAMP(3),
  "monthOfClearance" TEXT,
  "reviewDurationDays" INTEGER,
  "remarks" TEXT,
  "panel" TEXT,
  "scientistReviewer" TEXT,
  "layReviewer" TEXT,
  "independentConsultant" TEXT,
  "honorariumStatus" TEXT,
  "classificationOfProposalRerc" TEXT,
  "totalDays" INTEGER,
  "submissionCount" INTEGER,
  "withdrawn" BOOLEAN,
  "projectEndDate6A" TIMESTAMP(3),
  "clearanceExpiration" TIMESTAMP(3),
  "progressReportTargetDate" TIMESTAMP(3),
  "progressReportSubmission" TIMESTAMP(3),
  "progressReportApprovalDate" TIMESTAMP(3),
  "progressReportStatus" TEXT,
  "progressReportDays" INTEGER,
  "finalReportTargetDate" TIMESTAMP(3),
  "finalReportSubmission" TIMESTAMP(3),
  "finalReportCompletionDate" TIMESTAMP(3),
  "finalReportStatus" TEXT,
  "finalReportDays" INTEGER,
  "amendmentSubmission" TIMESTAMP(3),
  "amendmentStatusOfRequest" TEXT,
  "amendmentApprovalDate" TIMESTAMP(3),
  "amendmentDays" INTEGER,
  "continuingSubmission" TIMESTAMP(3),
  "continuingStatusOfRequest" TEXT,
  "continuingApprovalDate" TIMESTAMP(3),
  "continuingDays" INTEGER,
  "primaryReviewer" TEXT,
  "finalLayReviewer" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProtocolProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProtocolMilestone" (
  "id" SERIAL NOT NULL,
  "projectId" INTEGER NOT NULL,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "label" TEXT NOT NULL,
  "days" INTEGER,
  "dateOccurred" TIMESTAMP(3),
  "ownerRole" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProtocolMilestone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProtocolProfile_projectId_key" ON "ProtocolProfile"("projectId");
CREATE INDEX "ProtocolMilestone_projectId_orderIndex_idx" ON "ProtocolMilestone"("projectId", "orderIndex");

ALTER TABLE "ProtocolProfile"
ADD CONSTRAINT "ProtocolProfile_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProtocolMilestone"
ADD CONSTRAINT "ProtocolMilestone_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
