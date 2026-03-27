ALTER TABLE "User"
ADD COLUMN     "forcePasswordChange" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User"
SET "isActive" = FALSE
WHERE "status" IN ('PENDING', 'REJECTED', 'DISABLED');

ALTER TABLE "User"
DROP COLUMN "passwordResetToken",
DROP COLUMN "passwordResetExpiresAt";
