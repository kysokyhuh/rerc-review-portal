-- Allow delayed backfilling for protocol import/create flows.
ALTER TABLE "Project"
  ALTER COLUMN "title" DROP NOT NULL,
  ALTER COLUMN "piName" DROP NOT NULL,
  ALTER COLUMN "fundingType" DROP NOT NULL;

ALTER TABLE "ProjectSnapshot"
  ALTER COLUMN "title" DROP NOT NULL,
  ALTER COLUMN "piName" DROP NOT NULL,
  ALTER COLUMN "fundingType" DROP NOT NULL;

ALTER TABLE "Submission"
  ALTER COLUMN "submissionType" DROP NOT NULL,
  ALTER COLUMN "receivedDate" DROP NOT NULL;
