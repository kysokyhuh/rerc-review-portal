import prisma from "../config/prismaClient";
import {
  Prisma,
  ProjectOrigin,
  ProjectStatus,
  RoleType,
  UserStatus,
} from "../generated/prisma/client";
import { syncLegacyProfileToWorkflow } from "../services/projects/legacyImportWorkflow";

type ScriptOptions = {
  apply: boolean;
  limit: number;
  projectId: number | null;
};

type CandidateProject = Awaited<ReturnType<typeof loadCandidateProjects>>[number];

type LegacySnapshotRow = {
  projectId: number;
  importedStatus: string | null;
  importedTypeOfReview: string | null;
  importedClassificationOfProposal: string | null;
  importedPanel: string | null;
  importedScientistReviewer: string | null;
  importedLayReviewer: string | null;
  importedPrimaryReviewer: string | null;
  importedFinalLayReviewer: string | null;
  importedIndependentConsultant: string | null;
  importedHonorariumStatus: string | null;
  importedTotalDays: number | null;
  importedSubmissionCount: number | null;
  importedReviewDurationDays: number | null;
  importedClassificationDays: number | null;
  importedFinishDate: Date | null;
  importedClassificationDate: Date | null;
  importedMonthOfClearance: string | null;
  importedWithdrawn: boolean | null;
  importedProjectEndDate6A: Date | null;
  importedClearanceExpiration: Date | null;
  importedProgressReportTargetDate: Date | null;
  importedProgressReportSubmission: Date | null;
  importedProgressReportApprovalDate: Date | null;
  importedProgressReportStatus: string | null;
  importedProgressReportDays: number | null;
  importedFinalReportTargetDate: Date | null;
  importedFinalReportSubmission: Date | null;
  importedFinalReportCompletionDate: Date | null;
  importedFinalReportStatus: string | null;
  importedFinalReportDays: number | null;
  importedAmendmentSubmission: Date | null;
  importedAmendmentStatus: string | null;
  importedAmendmentApprovalDate: Date | null;
  importedAmendmentDays: number | null;
  importedContinuingSubmission: Date | null;
  importedContinuingStatus: string | null;
  importedContinuingApprovalDate: Date | null;
  importedContinuingDays: number | null;
  importedRemarks: string | null;
  rawRowJson: Prisma.JsonValue | null;
};

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

const hasLegacySnapshotTable = async () => {
  const result = await prisma.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = 'LegacyImportSnapshot'
    ) AS "exists"
  `);

  return result[0]?.exists === true;
};

const loadSnapshotProjectIds = async (options: ScriptOptions) => {
  if (!(await hasLegacySnapshotTable())) {
    return [];
  }

  const rows = await prisma.$queryRaw<Array<{ projectId: number }>>(
    options.projectId
      ? Prisma.sql`
          SELECT DISTINCT "projectId" AS "projectId"
          FROM "LegacyImportSnapshot"
          WHERE "projectId" = ${options.projectId}
        `
      : Prisma.sql`
          SELECT DISTINCT "projectId" AS "projectId"
          FROM "LegacyImportSnapshot"
          ORDER BY "projectId" ASC
          LIMIT ${options.limit}
        `
  );

  return rows.map((row) => row.projectId);
};

const loadSnapshotRowsByProjectId = async (projectIds: number[]) => {
  if (projectIds.length === 0 || !(await hasLegacySnapshotTable())) {
    return new Map<number, LegacySnapshotRow>();
  }

  const rows = await prisma.$queryRaw<LegacySnapshotRow[]>(Prisma.sql`
    SELECT
      "projectId" AS "projectId",
      "importedStatus" AS "importedStatus",
      "importedTypeOfReview" AS "importedTypeOfReview",
      "importedClassificationOfProposal" AS "importedClassificationOfProposal",
      "importedPanel" AS "importedPanel",
      "importedScientistReviewer" AS "importedScientistReviewer",
      "importedLayReviewer" AS "importedLayReviewer",
      "importedPrimaryReviewer" AS "importedPrimaryReviewer",
      "importedFinalLayReviewer" AS "importedFinalLayReviewer",
      "importedIndependentConsultant" AS "importedIndependentConsultant",
      "importedHonorariumStatus" AS "importedHonorariumStatus",
      "importedTotalDays" AS "importedTotalDays",
      "importedSubmissionCount" AS "importedSubmissionCount",
      "importedReviewDurationDays" AS "importedReviewDurationDays",
      "importedClassificationDays" AS "importedClassificationDays",
      "importedFinishDate" AS "importedFinishDate",
      "importedClassificationDate" AS "importedClassificationDate",
      "importedMonthOfClearance" AS "importedMonthOfClearance",
      "importedWithdrawn" AS "importedWithdrawn",
      "importedProjectEndDate6A" AS "importedProjectEndDate6A",
      "importedClearanceExpiration" AS "importedClearanceExpiration",
      "importedProgressReportTargetDate" AS "importedProgressReportTargetDate",
      "importedProgressReportSubmission" AS "importedProgressReportSubmission",
      "importedProgressReportApprovalDate" AS "importedProgressReportApprovalDate",
      "importedProgressReportStatus" AS "importedProgressReportStatus",
      "importedProgressReportDays" AS "importedProgressReportDays",
      "importedFinalReportTargetDate" AS "importedFinalReportTargetDate",
      "importedFinalReportSubmission" AS "importedFinalReportSubmission",
      "importedFinalReportCompletionDate" AS "importedFinalReportCompletionDate",
      "importedFinalReportStatus" AS "importedFinalReportStatus",
      "importedFinalReportDays" AS "importedFinalReportDays",
      "importedAmendmentSubmission" AS "importedAmendmentSubmission",
      "importedAmendmentStatus" AS "importedAmendmentStatus",
      "importedAmendmentApprovalDate" AS "importedAmendmentApprovalDate",
      "importedAmendmentDays" AS "importedAmendmentDays",
      "importedContinuingSubmission" AS "importedContinuingSubmission",
      "importedContinuingStatus" AS "importedContinuingStatus",
      "importedContinuingApprovalDate" AS "importedContinuingApprovalDate",
      "importedContinuingDays" AS "importedContinuingDays",
      "importedRemarks" AS "importedRemarks",
      "rawRowJson" AS "rawRowJson"
    FROM "LegacyImportSnapshot"
    WHERE "projectId" IN (${Prisma.join(projectIds)})
  `);

  return new Map(rows.map((row) => [row.projectId, row]));
};

const loadCandidateProjects = async (options: ScriptOptions) => {
  const snapshotProjectIds = await loadSnapshotProjectIds(options);
  const whereClauses: Prisma.ProjectWhereInput[] = [];

  if (options.projectId) {
    whereClauses.push({ id: options.projectId });
  } else {
    whereClauses.push({ origin: ProjectOrigin.LEGACY_IMPORT });
    if (snapshotProjectIds.length > 0) {
      whereClauses.push({ id: { in: snapshotProjectIds } });
    }
  }

  return prisma.project.findMany({
    where:
      whereClauses.length === 1
        ? whereClauses[0]
        : {
            OR: whereClauses,
          },
    take: options.limit,
    orderBy: { id: "asc" },
    include: {
      protocolProfile: true,
      submissions: {
        orderBy: [{ sequenceNumber: "asc" }, { id: "asc" }],
        select: {
          id: true,
          createdById: true,
        },
      },
    },
  });
};

const resolveFallbackActorId = async () => {
  const actor = await prisma.user.findFirst({
    where: {
      isActive: true,
      status: UserStatus.APPROVED,
      roles: {
        hasSome: [RoleType.ADMIN, RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE],
      },
    },
    orderBy: { id: "asc" },
    select: { id: true },
  });

  if (!actor) {
    throw new Error("No approved admin/chair/research associate available to attribute backfill changes.");
  }

  return actor.id;
};

const buildSyncData = (
  project: CandidateProject,
  snapshot: LegacySnapshotRow | null
) => {
  const profile = project.protocolProfile;

  return {
    status: snapshot?.importedStatus ?? profile?.status ?? null,
    typeOfReview: snapshot?.importedTypeOfReview ?? profile?.typeOfReview ?? null,
    classificationOfProposalRerc:
      snapshot?.importedClassificationOfProposal ?? profile?.classificationOfProposalRerc ?? null,
    withdrawn: snapshot?.importedWithdrawn ?? profile?.withdrawn ?? null,
    finishDate:
      snapshot?.importedFinishDate ?? profile?.finishDate ?? profile?.finalReportCompletionDate ?? null,
    classificationDate: snapshot?.importedClassificationDate ?? null,
    dateOfSubmission: profile?.dateOfSubmission ?? project.initialSubmissionDate ?? null,
    panel: snapshot?.importedPanel ?? profile?.panel ?? null,
    primaryReviewer: snapshot?.importedPrimaryReviewer ?? profile?.primaryReviewer ?? null,
    scientistReviewer: snapshot?.importedScientistReviewer ?? profile?.scientistReviewer ?? null,
    layReviewer: snapshot?.importedLayReviewer ?? profile?.layReviewer ?? null,
    finalLayReviewer: snapshot?.importedFinalLayReviewer ?? profile?.finalLayReviewer ?? null,
    independentConsultant:
      snapshot?.importedIndependentConsultant ?? profile?.independentConsultant ?? null,
    clearanceExpiration:
      snapshot?.importedClearanceExpiration ?? profile?.clearanceExpiration ?? null,
    projectEndDate6A: snapshot?.importedProjectEndDate6A ?? profile?.projectEndDate6A ?? null,
    progressReportTargetDate:
      snapshot?.importedProgressReportTargetDate ?? profile?.progressReportTargetDate ?? null,
    progressReportSubmission:
      snapshot?.importedProgressReportSubmission ?? profile?.progressReportSubmission ?? null,
    progressReportApprovalDate:
      snapshot?.importedProgressReportApprovalDate ?? profile?.progressReportApprovalDate ?? null,
    progressReportStatus:
      snapshot?.importedProgressReportStatus ?? profile?.progressReportStatus ?? null,
    progressReportDays: snapshot?.importedProgressReportDays ?? profile?.progressReportDays ?? null,
    finalReportTargetDate:
      snapshot?.importedFinalReportTargetDate ?? profile?.finalReportTargetDate ?? null,
    finalReportSubmission:
      snapshot?.importedFinalReportSubmission ?? profile?.finalReportSubmission ?? null,
    finalReportCompletionDate:
      snapshot?.importedFinalReportCompletionDate ?? profile?.finalReportCompletionDate ?? null,
    finalReportStatus: snapshot?.importedFinalReportStatus ?? profile?.finalReportStatus ?? null,
    finalReportDays: snapshot?.importedFinalReportDays ?? profile?.finalReportDays ?? null,
    amendmentSubmission:
      snapshot?.importedAmendmentSubmission ?? profile?.amendmentSubmission ?? null,
    amendmentStatus:
      snapshot?.importedAmendmentStatus ?? profile?.amendmentStatusOfRequest ?? null,
    amendmentApprovalDate:
      snapshot?.importedAmendmentApprovalDate ?? profile?.amendmentApprovalDate ?? null,
    amendmentDays: snapshot?.importedAmendmentDays ?? profile?.amendmentDays ?? null,
    continuingSubmission:
      snapshot?.importedContinuingSubmission ?? profile?.continuingSubmission ?? null,
    continuingStatus:
      snapshot?.importedContinuingStatus ?? profile?.continuingStatusOfRequest ?? null,
    continuingApprovalDate:
      snapshot?.importedContinuingApprovalDate ?? profile?.continuingApprovalDate ?? null,
    continuingDays: snapshot?.importedContinuingDays ?? profile?.continuingDays ?? null,
    remarks: snapshot?.importedRemarks ?? profile?.remarks ?? null,
    rawRowJson:
      snapshot?.rawRowJson && typeof snapshot.rawRowJson === "object"
        ? (snapshot.rawRowJson as Record<string, string>)
        : null,
  };
};

const main = async () => {
  const options = parseArgs();
  const fallbackActorId = await resolveFallbackActorId();
  const loaded = await loadCandidateProjects(options);
  const snapshotsByProjectId = await loadSnapshotRowsByProjectId(loaded.map((project) => project.id));
  const candidates = loaded.filter((project) => project.submissions.length > 0);

  console.log(
    JSON.stringify(
      {
        apply: options.apply,
        projectId: options.projectId,
        loadedCount: loaded.length,
        candidateCount: candidates.length,
        candidates: candidates.map((project) => ({
          id: project.id,
          projectCode: project.projectCode,
          title: project.title,
          hasSnapshot: snapshotsByProjectId.has(project.id),
          hasProfile: Boolean(project.protocolProfile),
        })),
      },
      null,
      2
    )
  );

  if (!options.apply || candidates.length === 0) {
    return;
  }

  let processed = 0;
  for (const project of candidates) {
    const sourceSubmissionId = project.submissions[0]?.id ?? null;
    if (!sourceSubmissionId) continue;

    const changedById =
      project.createdById ?? project.submissions[0]?.createdById ?? fallbackActorId;

    await prisma.$transaction(async (tx) => {
      await syncLegacyProfileToWorkflow(tx, {
        projectId: project.id,
        committeeId: project.committeeId,
        projectStatus: project.overallStatus as ProjectStatus,
        sourceSubmissionId,
        changedById,
        data: buildSyncData(project, snapshotsByProjectId.get(project.id) ?? null),
      });
    });

    processed += 1;
  }

  console.log(
    JSON.stringify(
      {
        processed,
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
