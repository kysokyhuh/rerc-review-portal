import prisma from "../../config/prismaClient";
import {
  ProjectOrigin,
  SLAStage,
  SubmissionStatus,
} from "../../generated/prisma/client";
import {
  buildSlaConfigMap,
  computeDueDate,
  getConfiguredSlaOrDefault,
} from "../sla/submissionSlaService";
import { hasTableColumns } from "../../utils/schemaIntrospection";

const PROMOTION_TARGET_STATUSES = [
  SubmissionStatus.AWAITING_CLASSIFICATION,
  SubmissionStatus.UNDER_CLASSIFICATION,
  SubmissionStatus.CLASSIFIED,
  SubmissionStatus.UNDER_REVIEW,
  SubmissionStatus.AWAITING_REVISIONS,
  SubmissionStatus.REVISION_SUBMITTED,
  SubmissionStatus.CLOSED,
  SubmissionStatus.WITHDRAWN,
] as const;

type PromoteImportedSubmissionsOptions = {
  committeeCode?: string;
  submissionIds?: number[];
};

const resolveWorkflowStartDate = (submission: {
  createdAt: Date;
  project: {
    legacyImportSnapshot: { importedAt: Date } | null;
    importBatch: { createdAt: Date } | null;
  } | null;
}) =>
  submission.project?.legacyImportSnapshot?.importedAt ??
  submission.project?.importBatch?.createdAt ??
  submission.createdAt;

const hasLegacyImportPromotionSchema = async () => {
  const [hasProjectColumns, hasImportBatchColumns, hasLegacySnapshotColumns] =
    await Promise.all([
      hasTableColumns("Project", ["origin", "importBatchId"]),
      hasTableColumns("ImportBatch", ["id", "createdAt"]),
      hasTableColumns("LegacyImportSnapshot", ["projectId", "importedAt"]),
    ]);

  return hasProjectColumns && hasImportBatchColumns && hasLegacySnapshotColumns;
};

export async function promoteImportedSubmissionsToWorkflow(
  options: PromoteImportedSubmissionsOptions = {}
) {
  if (!(await hasLegacyImportPromotionSchema())) {
    return { promotedCount: 0 };
  }

  const candidates = await prisma.submission.findMany({
    where: {
      sequenceNumber: 1,
      status: SubmissionStatus.RECEIVED,
      classificationDueDate: null,
      ...(options.submissionIds?.length
        ? { id: { in: options.submissionIds } }
        : {}),
      statusHistory: {
        none: {
          newStatus: {
            in: [...PROMOTION_TARGET_STATUSES],
          },
        },
      },
      project: {
        origin: ProjectOrigin.LEGACY_IMPORT,
        ...(options.committeeCode
          ? { committee: { code: options.committeeCode } }
          : {}),
      },
    },
    select: {
      id: true,
      createdAt: true,
      project: {
        select: {
          id: true,
          committeeId: true,
          legacyImportSnapshot: {
            select: {
              importedAt: true,
            },
          },
          importBatch: {
            select: {
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (candidates.length === 0) {
    return { promotedCount: 0 };
  }

  const committeeIds = Array.from(
    new Set(
      candidates
        .map((candidate) => candidate.project?.committeeId ?? null)
        .filter((value): value is number => Number.isInteger(value))
    )
  );

  const [holidayRows, slaConfigs] = await Promise.all([
    prisma.holiday.findMany({ select: { date: true } }),
    prisma.configSLA.findMany({
      where: {
        isActive: true,
        ...(committeeIds.length > 0
          ? { committeeId: { in: committeeIds } }
          : {}),
      },
      select: {
        committeeId: true,
        stage: true,
        reviewType: true,
        workingDays: true,
        dayMode: true,
        description: true,
      },
    }),
  ]);

  const holidayDates = holidayRows.map((row) => row.date);
  const slaConfigMap = buildSlaConfigMap(slaConfigs);
  let promotedCount = 0;

  for (const candidate of candidates) {
    if (!candidate.project) continue;

    const workflowStartDate = resolveWorkflowStartDate(candidate);
    const classificationConfig = getConfiguredSlaOrDefault(
      slaConfigMap,
      candidate.project.committeeId,
      SLAStage.CLASSIFICATION,
      null
    );
    const classificationDueDate = classificationConfig
      ? computeDueDate(
          classificationConfig.dayMode,
          workflowStartDate,
          classificationConfig.targetDays,
          holidayDates
        )
      : null;

    const updated = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.submission.updateMany({
        where: {
          id: candidate.id,
          status: SubmissionStatus.RECEIVED,
          classificationDueDate: null,
        },
        data: {
          status: SubmissionStatus.AWAITING_CLASSIFICATION,
          receivedDate: workflowStartDate,
          completenessStatus: "COMPLETE",
          completenessRemarks: null,
          classificationDueDate,
        },
      });

      if (updateResult.count === 0) {
        return false;
      }

      await tx.project.update({
        where: { id: candidate.project!.id },
        data: {
          initialSubmissionDate: workflowStartDate,
        },
      });

      await tx.submissionStatusHistory.create({
        data: {
          submissionId: candidate.id,
          oldStatus: SubmissionStatus.RECEIVED,
          newStatus: SubmissionStatus.AWAITING_CLASSIFICATION,
          effectiveDate: workflowStartDate,
          reason: "Imported record entered the live workflow on upload.",
        },
      });

      return true;
    });

    if (updated) {
      promotedCount += 1;
    }
  }

  return { promotedCount };
}
