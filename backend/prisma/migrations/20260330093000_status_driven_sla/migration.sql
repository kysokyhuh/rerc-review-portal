ALTER TYPE "SLAStage" ADD VALUE IF NOT EXISTS 'EXEMPT_NOTIFICATION';

DO $$
BEGIN
  CREATE TYPE "SLADayMode" AS ENUM ('CALENDAR', 'WORKING');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Submission"
  ADD COLUMN IF NOT EXISTS "classificationDueDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "exemptNotificationDueDate" TIMESTAMP(3);

ALTER TABLE "ConfigSLA"
  ADD COLUMN IF NOT EXISTS "dayMode" "SLADayMode" NOT NULL DEFAULT 'WORKING';

UPDATE "ConfigSLA"
SET
  "workingDays" = 14,
  "dayMode" = 'CALENDAR',
  "description" = COALESCE("description", 'Classification within 14 calendar days')
WHERE "stage" = 'CLASSIFICATION';

UPDATE "ConfigSLA"
SET
  "workingDays" = 20,
  "dayMode" = 'WORKING',
  "description" = 'Expedited review within 20 working days'
WHERE "stage" = 'REVIEW'
  AND "reviewType" = 'EXPEDITED';

UPDATE "ConfigSLA"
SET
  "workingDays" = 30,
  "dayMode" = 'WORKING',
  "description" = 'Full board review within 30 working days'
WHERE "stage" = 'REVIEW'
  AND "reviewType" = 'FULL_BOARD';

UPDATE "ConfigSLA"
SET
  "workingDays" = 7,
  "dayMode" = 'CALENDAR',
  "description" = 'Researchers have up to 7 calendar days to respond to revisions'
WHERE "stage" = 'REVISION_RESPONSE';

INSERT INTO "ConfigSLA" ("committeeId", "reviewType", "stage", "workingDays", "dayMode", "description", "isActive", "createdAt", "updatedAt")
SELECT
  c."id",
  'EXEMPT'::"ReviewType",
  'EXEMPT_NOTIFICATION'::"SLAStage",
  7,
  'CALENDAR'::"SLADayMode",
  'Notify proponents of exempted protocols within 7 calendar days',
  TRUE,
  NOW(),
  NOW()
FROM "Committee" c
WHERE NOT EXISTS (
  SELECT 1
  FROM "ConfigSLA" s
  WHERE s."committeeId" = c."id"
    AND s."stage" = 'EXEMPT_NOTIFICATION'
    AND s."reviewType" = 'EXEMPT'
);
