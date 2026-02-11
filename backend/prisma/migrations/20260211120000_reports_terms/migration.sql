-- CreateEnum
CREATE TYPE "ProponentCategory" AS ENUM ('UNDERGRAD', 'GRAD', 'FACULTY', 'OTHER');

-- AlterTable
ALTER TABLE "Project"
ADD COLUMN "collegeOrUnit" TEXT,
ADD COLUMN "proponentCategory" "ProponentCategory";

-- CreateTable
CREATE TABLE "AcademicTerm" (
    "id" SERIAL NOT NULL,
    "academicYear" TEXT NOT NULL,
    "term" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicTerm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AcademicTerm_academicYear_term_key" ON "AcademicTerm"("academicYear", "term");

-- CreateIndex
CREATE INDEX "AcademicTerm_academicYear_idx" ON "AcademicTerm"("academicYear");
