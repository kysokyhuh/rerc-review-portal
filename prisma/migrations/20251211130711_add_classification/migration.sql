-- CreateEnum
CREATE TYPE "ReviewType" AS ENUM ('EXEMPT', 'EXPEDITED', 'FULL_BOARD');

-- CreateTable
CREATE TABLE "Classification" (
    "id" SERIAL NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "reviewType" "ReviewType" NOT NULL,
    "classificationDate" TIMESTAMP(3) NOT NULL,
    "panelId" INTEGER,
    "rationale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "classifiedById" INTEGER,

    CONSTRAINT "Classification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Classification_submissionId_key" ON "Classification"("submissionId");

-- AddForeignKey
ALTER TABLE "Classification" ADD CONSTRAINT "Classification_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classification" ADD CONSTRAINT "Classification_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classification" ADD CONSTRAINT "Classification_classifiedById_fkey" FOREIGN KEY ("classifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
