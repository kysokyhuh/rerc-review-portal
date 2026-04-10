DO $$
BEGIN
  CREATE TYPE "ProjectOrigin" AS ENUM ('NATIVE_PORTAL', 'LEGACY_IMPORT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ImportMode" AS ENUM ('INTAKE_IMPORT', 'LEGACY_MIGRATION');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "origin" "ProjectOrigin" NOT NULL DEFAULT 'NATIVE_PORTAL',
  ADD COLUMN IF NOT EXISTS "importBatchId" INTEGER,
  ADD COLUMN IF NOT EXISTS "importSourceRowNumber" INTEGER;

CREATE TABLE IF NOT EXISTS "ImportBatch" (
  "id" SERIAL NOT NULL,
  "mode" "ImportMode" NOT NULL,
  "sourceFilename" TEXT,
  "sourceFileHash" TEXT NOT NULL,
  "receivedRows" INTEGER NOT NULL DEFAULT 0,
  "insertedRows" INTEGER NOT NULL DEFAULT 0,
  "failedRows" INTEGER NOT NULL DEFAULT 0,
  "warningRows" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "summaryJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "uploadedById" INTEGER,

  CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LegacyImportSnapshot" (
  "id" SERIAL NOT NULL,
  "projectId" INTEGER NOT NULL,
  "importBatchId" INTEGER,
  "sourceRowNumber" INTEGER,
  "importedStatus" TEXT,
  "importedTypeOfReview" TEXT,
  "importedClassificationOfProposal" TEXT,
  "importedPanel" TEXT,
  "importedScientistReviewer" TEXT,
  "importedLayReviewer" TEXT,
  "importedPrimaryReviewer" TEXT,
  "importedFinalLayReviewer" TEXT,
  "importedIndependentConsultant" TEXT,
  "importedHonorariumStatus" TEXT,
  "importedTotalDays" INTEGER,
  "importedSubmissionCount" INTEGER,
  "importedReviewDurationDays" INTEGER,
  "importedClassificationDays" INTEGER,
  "importedFinishDate" TIMESTAMP(3),
  "importedClassificationDate" TIMESTAMP(3),
  "importedMonthOfClearance" TEXT,
  "importedWithdrawn" BOOLEAN,
  "importedProjectEndDate6A" TIMESTAMP(3),
  "importedClearanceExpiration" TIMESTAMP(3),
  "importedProgressReportTargetDate" TIMESTAMP(3),
  "importedProgressReportSubmission" TIMESTAMP(3),
  "importedProgressReportApprovalDate" TIMESTAMP(3),
  "importedProgressReportStatus" TEXT,
  "importedProgressReportDays" INTEGER,
  "importedFinalReportTargetDate" TIMESTAMP(3),
  "importedFinalReportSubmission" TIMESTAMP(3),
  "importedFinalReportCompletionDate" TIMESTAMP(3),
  "importedFinalReportStatus" TEXT,
  "importedFinalReportDays" INTEGER,
  "importedAmendmentSubmission" TIMESTAMP(3),
  "importedAmendmentStatus" TEXT,
  "importedAmendmentApprovalDate" TIMESTAMP(3),
  "importedAmendmentDays" INTEGER,
  "importedContinuingSubmission" TIMESTAMP(3),
  "importedContinuingStatus" TEXT,
  "importedContinuingApprovalDate" TIMESTAMP(3),
  "importedContinuingDays" INTEGER,
  "importedRemarks" TEXT,
  "rawRowJson" JSONB NOT NULL,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LegacyImportSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LegacyImportSnapshot_projectId_key"
  ON "LegacyImportSnapshot"("projectId");

CREATE INDEX IF NOT EXISTS "Project_importBatchId_idx"
  ON "Project"("importBatchId");

CREATE INDEX IF NOT EXISTS "ImportBatch_uploadedById_idx"
  ON "ImportBatch"("uploadedById");

CREATE INDEX IF NOT EXISTS "ImportBatch_mode_createdAt_idx"
  ON "ImportBatch"("mode", "createdAt");

CREATE INDEX IF NOT EXISTS "LegacyImportSnapshot_importBatchId_idx"
  ON "LegacyImportSnapshot"("importBatchId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'Project_importBatchId_fkey'
      AND table_name = 'Project'
  ) THEN
    ALTER TABLE "Project"
      ADD CONSTRAINT "Project_importBatchId_fkey"
      FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'ImportBatch_uploadedById_fkey'
      AND table_name = 'ImportBatch'
  ) THEN
    ALTER TABLE "ImportBatch"
      ADD CONSTRAINT "ImportBatch_uploadedById_fkey"
      FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'LegacyImportSnapshot_projectId_fkey'
      AND table_name = 'LegacyImportSnapshot'
  ) THEN
    ALTER TABLE "LegacyImportSnapshot"
      ADD CONSTRAINT "LegacyImportSnapshot_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'LegacyImportSnapshot_importBatchId_fkey'
      AND table_name = 'LegacyImportSnapshot'
  ) THEN
    ALTER TABLE "LegacyImportSnapshot"
      ADD CONSTRAINT "LegacyImportSnapshot_importBatchId_fkey"
      FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
