DO $$
BEGIN
  CREATE TYPE "ReminderTarget" AS ENUM ('PROPONENT', 'REVIEWER', 'INTERNAL_STAFF');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "SubmissionReminderLog" (
  "id" SERIAL NOT NULL,
  "submissionId" INTEGER NOT NULL,
  "target" "ReminderTarget" NOT NULL,
  "note" TEXT NOT NULL,
  "actorId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SubmissionReminderLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SubmissionReminderLog_submissionId_createdAt_idx"
  ON "SubmissionReminderLog"("submissionId", "createdAt");

CREATE INDEX IF NOT EXISTS "SubmissionReminderLog_actorId_idx"
  ON "SubmissionReminderLog"("actorId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'SubmissionReminderLog_submissionId_fkey'
      AND table_name = 'SubmissionReminderLog'
  ) THEN
    ALTER TABLE "SubmissionReminderLog"
      ADD CONSTRAINT "SubmissionReminderLog_submissionId_fkey"
      FOREIGN KEY ("submissionId") REFERENCES "Submission"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'SubmissionReminderLog_actorId_fkey'
      AND table_name = 'SubmissionReminderLog'
  ) THEN
    ALTER TABLE "SubmissionReminderLog"
      ADD CONSTRAINT "SubmissionReminderLog_actorId_fkey"
      FOREIGN KEY ("actorId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
