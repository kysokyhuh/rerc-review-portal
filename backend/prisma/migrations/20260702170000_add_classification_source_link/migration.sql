ALTER TABLE "Classification" ADD COLUMN "sourceLink" TEXT;

UPDATE "Classification"
SET "sourceLink" = substring("rationale" FROM 'Source link: ([^\r\n]+)')
WHERE "sourceLink" IS NULL
  AND "rationale" LIKE '%Source link:%';
