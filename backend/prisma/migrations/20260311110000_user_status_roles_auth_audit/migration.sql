DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserStatus') THEN
    CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED');
  END IF;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "roles" "RoleType"[] NOT NULL DEFAULT ARRAY[]::"RoleType"[],
  ADD COLUMN IF NOT EXISTS "statusNote" TEXT;

-- Existing active users become ACTIVE; inactive users become REJECTED.
UPDATE "User"
SET "status" = CASE
  WHEN "isActive" = true THEN 'ACTIVE'::"UserStatus"
  ELSE 'REJECTED'::"UserStatus"
END
WHERE "status" = 'PENDING'::"UserStatus";

-- Backfill effective roles from committee memberships when roles are empty.
UPDATE "User" u
SET "roles" = r.roles
FROM (
  SELECT "userId", ARRAY_AGG(DISTINCT "role")::"RoleType"[] AS roles
  FROM "CommitteeMember"
  GROUP BY "userId"
) r
WHERE u."id" = r."userId"
  AND COALESCE(array_length(u."roles", 1), 0) = 0;

DO $$
BEGIN
  IF to_regclass('"AuditLog"') IS NULL THEN
    CREATE TABLE "AuditLog" (
      "id" SERIAL PRIMARY KEY,
      "actorId" INTEGER,
      "action" TEXT NOT NULL,
      "entityType" TEXT NOT NULL,
      "entityId" TEXT NOT NULL,
      "metadataJson" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  ELSE
    ALTER TABLE "AuditLog"
      ADD COLUMN IF NOT EXISTS "actorId" INTEGER,
      ADD COLUMN IF NOT EXISTS "action" TEXT,
      ADD COLUMN IF NOT EXISTS "entityType" TEXT,
      ADD COLUMN IF NOT EXISTS "entityId" TEXT,
      ADD COLUMN IF NOT EXISTS "metadataJson" JSONB,
      ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

    UPDATE "AuditLog" SET "action" = COALESCE("action", 'LEGACY_EVENT');
    UPDATE "AuditLog" SET "entityType" = COALESCE("entityType", 'Legacy');
    UPDATE "AuditLog" SET "entityId" = COALESCE("entityId", '0');

    ALTER TABLE "AuditLog"
      ALTER COLUMN "action" SET NOT NULL,
      ALTER COLUMN "entityType" SET NOT NULL,
      ALTER COLUMN "entityId" SET NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'AuditLog' AND constraint_name = 'AuditLog_actorId_fkey'
  ) THEN
    ALTER TABLE "AuditLog"
      ADD CONSTRAINT "AuditLog_actorId_fkey"
      FOREIGN KEY ("actorId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "AuditLog_actorId_idx" ON "AuditLog"("actorId");
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
