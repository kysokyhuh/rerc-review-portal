import { createHash } from "crypto";
import prisma from "../config/prismaClient";
import { ImportMode, ProjectOrigin } from "../generated/prisma/client";

type ScriptOptions = {
  apply: boolean;
  limit: number;
  projectId: number | null;
};

type CandidateProject = Awaited<ReturnType<typeof loadCandidates>>[number];

const LEGACY_SIGNAL_FIELDS = [
  "status",
  "finishDate",
  "monthOfClearance",
  "reviewDurationDays",
  "panel",
  "scientistReviewer",
  "layReviewer",
  "independentConsultant",
  "honorariumStatus",
  "classificationOfProposalRerc",
  "totalDays",
  "submissionCount",
  "withdrawn",
  "projectEndDate6A",
  "clearanceExpiration",
  "progressReportTargetDate",
  "progressReportSubmission",
  "progressReportApprovalDate",
  "progressReportStatus",
  "progressReportDays",
  "finalReportTargetDate",
  "finalReportSubmission",
  "finalReportCompletionDate",
  "finalReportStatus",
  "finalReportDays",
  "amendmentSubmission",
  "amendmentStatusOfRequest",
  "amendmentApprovalDate",
  "amendmentDays",
  "continuingSubmission",
  "continuingStatusOfRequest",
  "continuingApprovalDate",
  "continuingDays",
  "primaryReviewer",
  "finalLayReviewer",
] as const;

const parseArgs = (): ScriptOptions => {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const limitArg = args.find((arg) => arg.startsWith("--limit="));
  const projectIdArg = args.find((arg) => arg.startsWith("--project-id="));

  return {
    apply,
    limit: limitArg ? Math.max(1, Number(limitArg.split("=")[1] || 0)) : 250,
    projectId: projectIdArg ? Number(projectIdArg.split("=")[1] || 0) : null,
  };
};

const hasLegacySignals = (profile: Record<string, unknown> | null | undefined) => {
  if (!profile) return false;
  return LEGACY_SIGNAL_FIELDS.some((field) => {
    const value = profile[field];
    return value !== null && value !== undefined && value !== "";
  });
};

const hasOnlyMinimalWorkflow = (
  submissions: Array<{
    classification: { id: number } | null;
    reviews: Array<{ id: number }>;
    reviewAssignments: Array<{ id: number }>;
    documents: Array<{ id: number }>;
  }>,
  milestoneCount: number
) =>
  milestoneCount === 0 &&
  submissions.length <= 1 &&
  submissions.every(
    (submission) =>
      !submission.classification &&
      submission.reviews.length === 0 &&
      submission.reviewAssignments.length === 0 &&
      submission.documents.length === 0
  );

const buildRawRowJson = (profile: NonNullable<CandidateProject["protocolProfile"]>) => ({
  title: profile.title,
  projectLeader: profile.projectLeader,
  college: profile.college,
  department: profile.department,
  dateOfSubmission: profile.dateOfSubmission?.toISOString() ?? null,
  monthOfSubmission: profile.monthOfSubmission,
  typeOfReview: profile.typeOfReview,
  proponent: profile.proponent,
  funding: profile.funding,
  typeOfResearchPhreb: profile.typeOfResearchPhreb,
  typeOfResearchPhrebOther: profile.typeOfResearchPhrebOther,
  remarks: profile.remarks,
  status: profile.status,
  finishDate: profile.finishDate?.toISOString() ?? null,
  monthOfClearance: profile.monthOfClearance,
  reviewDurationDays: profile.reviewDurationDays,
  panel: profile.panel,
  scientistReviewer: profile.scientistReviewer,
  layReviewer: profile.layReviewer,
  independentConsultant: profile.independentConsultant,
  honorariumStatus: profile.honorariumStatus,
  classificationOfProposalRerc: profile.classificationOfProposalRerc,
  totalDays: profile.totalDays,
  submissionCount: profile.submissionCount,
  withdrawn: profile.withdrawn,
  projectEndDate6A: profile.projectEndDate6A?.toISOString() ?? null,
  clearanceExpiration: profile.clearanceExpiration?.toISOString() ?? null,
  progressReportTargetDate: profile.progressReportTargetDate?.toISOString() ?? null,
  progressReportSubmission: profile.progressReportSubmission?.toISOString() ?? null,
  progressReportApprovalDate: profile.progressReportApprovalDate?.toISOString() ?? null,
  progressReportStatus: profile.progressReportStatus,
  progressReportDays: profile.progressReportDays,
  finalReportTargetDate: profile.finalReportTargetDate?.toISOString() ?? null,
  finalReportSubmission: profile.finalReportSubmission?.toISOString() ?? null,
  finalReportCompletionDate: profile.finalReportCompletionDate?.toISOString() ?? null,
  finalReportStatus: profile.finalReportStatus,
  finalReportDays: profile.finalReportDays,
  amendmentSubmission: profile.amendmentSubmission?.toISOString() ?? null,
  amendmentStatusOfRequest: profile.amendmentStatusOfRequest,
  amendmentApprovalDate: profile.amendmentApprovalDate?.toISOString() ?? null,
  amendmentDays: profile.amendmentDays,
  continuingSubmission: profile.continuingSubmission?.toISOString() ?? null,
  continuingStatusOfRequest: profile.continuingStatusOfRequest,
  continuingApprovalDate: profile.continuingApprovalDate?.toISOString() ?? null,
  continuingDays: profile.continuingDays,
  primaryReviewer: profile.primaryReviewer,
  finalLayReviewer: profile.finalLayReviewer,
});

const loadCandidates = async (options: ScriptOptions) =>
  prisma.project.findMany({
    where: {
      origin: ProjectOrigin.NATIVE_PORTAL,
      ...(options.projectId ? { id: options.projectId } : {}),
      protocolProfile: { isNot: null },
      legacyImportSnapshot: null,
    },
    take: options.limit,
    orderBy: { id: "asc" },
    include: {
      protocolProfile: true,
      legacyImportSnapshot: { select: { id: true } },
      protocolMilestones: { select: { id: true }, take: 1 },
      submissions: {
        orderBy: [{ sequenceNumber: "asc" }, { id: "asc" }],
        include: {
          classification: { select: { id: true } },
          reviews: { select: { id: true }, take: 1 },
          reviewAssignments: { select: { id: true }, take: 1 },
          documents: { select: { id: true }, take: 1 },
        },
      },
    },
  });

const projectIsCandidate = (project: CandidateProject) =>
  hasLegacySignals(project.protocolProfile) &&
  !project.legacyImportSnapshot &&
  hasOnlyMinimalWorkflow(project.submissions, project.protocolMilestones.length);

const main = async () => {
  const options = parseArgs();
  const loaded = await loadCandidates(options);
  const candidates = loaded.filter(projectIsCandidate);

  const summary = candidates.map((project) => ({
    id: project.id,
    projectCode: project.projectCode,
    title: project.title,
    legacySignals: LEGACY_SIGNAL_FIELDS.filter((field) => {
      const value = project.protocolProfile?.[field];
      return value !== null && value !== undefined && value !== "";
    }),
  }));

  console.log(
    JSON.stringify(
      {
        apply: options.apply,
        projectId: options.projectId,
        loadedCount: loaded.length,
        candidateCount: candidates.length,
        candidates: summary,
      },
      null,
      2
    )
  );

  if (!options.apply || candidates.length === 0) {
    return;
  }

  const hash = createHash("sha256")
    .update(JSON.stringify(summary))
    .digest("hex");
  const batch = await prisma.importBatch.create({
    data: {
      mode: ImportMode.LEGACY_MIGRATION,
      sourceFilename: "backfill:legacy-import-snapshot",
      sourceFileHash: hash,
      receivedRows: candidates.length,
      insertedRows: 0,
      failedRows: 0,
      warningRows: 0,
      notes:
        "Backfill from existing ProtocolProfile legacy-heavy fields. Original ProtocolProfile values retained.",
      summaryJson: {
        strategy: "conservative-backfill",
        candidateIds: candidates.map((project) => project.id),
      },
    },
    select: { id: true },
  });

  let insertedRows = 0;
  for (const project of candidates) {
    const profile = project.protocolProfile;
    if (!profile) continue;

    await prisma.$transaction(async (tx) => {
      await tx.legacyImportSnapshot.create({
        data: {
          projectId: project.id,
          importBatchId: batch.id,
          sourceRowNumber: project.importSourceRowNumber ?? 0,
          importedStatus: profile.status,
          importedTypeOfReview: profile.typeOfReview,
          importedClassificationOfProposal: profile.classificationOfProposalRerc,
          importedPanel: profile.panel,
          importedScientistReviewer: profile.scientistReviewer,
          importedLayReviewer: profile.layReviewer,
          importedPrimaryReviewer: profile.primaryReviewer,
          importedFinalLayReviewer: profile.finalLayReviewer,
          importedIndependentConsultant: profile.independentConsultant,
          importedHonorariumStatus: profile.honorariumStatus,
          importedTotalDays: profile.totalDays,
          importedSubmissionCount: profile.submissionCount,
          importedReviewDurationDays: profile.reviewDurationDays,
          importedFinishDate: profile.finishDate,
          importedMonthOfClearance: profile.monthOfClearance,
          importedWithdrawn: profile.withdrawn,
          importedProjectEndDate6A: profile.projectEndDate6A,
          importedClearanceExpiration: profile.clearanceExpiration,
          importedProgressReportTargetDate: profile.progressReportTargetDate,
          importedProgressReportSubmission: profile.progressReportSubmission,
          importedProgressReportApprovalDate: profile.progressReportApprovalDate,
          importedProgressReportStatus: profile.progressReportStatus,
          importedProgressReportDays: profile.progressReportDays,
          importedFinalReportTargetDate: profile.finalReportTargetDate,
          importedFinalReportSubmission: profile.finalReportSubmission,
          importedFinalReportCompletionDate: profile.finalReportCompletionDate,
          importedFinalReportStatus: profile.finalReportStatus,
          importedFinalReportDays: profile.finalReportDays,
          importedAmendmentSubmission: profile.amendmentSubmission,
          importedAmendmentStatus: profile.amendmentStatusOfRequest,
          importedAmendmentApprovalDate: profile.amendmentApprovalDate,
          importedAmendmentDays: profile.amendmentDays,
          importedContinuingSubmission: profile.continuingSubmission,
          importedContinuingStatus: profile.continuingStatusOfRequest,
          importedContinuingApprovalDate: profile.continuingApprovalDate,
          importedContinuingDays: profile.continuingDays,
          importedRemarks: profile.remarks,
          rawRowJson: buildRawRowJson(profile),
        },
      });

      await tx.project.update({
        where: { id: project.id },
        data: {
          origin: ProjectOrigin.LEGACY_IMPORT,
          importBatchId: batch.id,
        },
      });
    });

    insertedRows += 1;
  }

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      insertedRows,
      failedRows: candidates.length - insertedRows,
      warningRows: 0,
    },
  });

  console.log(
    JSON.stringify(
      {
        batchId: batch.id,
        insertedRows,
        skippedRows: candidates.length - insertedRows,
      },
      null,
      2
    )
  );
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
