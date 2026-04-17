ALTER TABLE "Project"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedById" INTEGER,
ADD COLUMN "deletedReason" TEXT,
ADD COLUMN "deletedFromStatus" "ProjectStatus",
ADD COLUMN "deletePurgeAt" TIMESTAMP(3),
ADD COLUMN "purgedAt" TIMESTAMP(3);

ALTER TABLE "Project"
ADD CONSTRAINT "Project_deletedById_fkey"
FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Project_deletedById_idx" ON "Project"("deletedById");
CREATE INDEX "Project_deletedAt_deletePurgeAt_purgedAt_idx" ON "Project"("deletedAt", "deletePurgeAt", "purgedAt");
