/*
  Warnings:

  - You are about to drop the `AuditLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_userId_fkey";

-- DropTable
DROP TABLE "AuditLog";

-- DropEnum
DROP TYPE "AuditAction";

-- DropEnum
DROP TYPE "AuditResourceType";
