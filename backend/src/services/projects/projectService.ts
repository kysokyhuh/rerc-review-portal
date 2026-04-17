/**
 * Project service — business logic extracted from projectRoutes.
 */
import prisma from "../../config/prismaClient";
import { AppError } from "../../middleware/errorHandler";
import {
  Prisma,
  ProjectStatus,
  ReviewDecision,
  ReviewerRoleType,
  ReviewerRoundRole,
  ReviewType,
  SLAStage,
  SubmissionStatus,
  UserStatus,
  type SubmissionType,
  type CompletenessStatus,
} from "../../generated/prisma/client";
import { promoteImportedSubmissionsToWorkflow } from "../imports/importedWorkflowPromotion";
import {
  buildSlaConfigMap,
  computeDueDate,
  getConfiguredSlaOrDefault,
} from "../sla/submissionSlaService";

/* ------------------------------------------------------------------ */
/*  Helpers (moved from routes)                                        */
/* ------------------------------------------------------------------ */
export const asNullableString = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
};

export const asNullableInt = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
};

export const asNullableBoolean = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return null;
};

export const asNullableDate = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const ARCHIVED_PROJECT_STATUSES = [ProjectStatus.CLOSED, ProjectStatus.WITHDRAWN] as const;

const normalizeArchiveProjectStatus = (value?: string | null) => {
  if (value === ProjectStatus.CLOSED || value === ProjectStatus.WITHDRAWN) {
    return value;
  }
  return null;
};

const compareNullableDates = (
  left: Date | string | null | undefined,
  right: Date | string | null | undefined,
  dir: "asc" | "desc"
) => {
  const leftTime = left ? new Date(left).getTime() : Number.NEGATIVE_INFINITY;
  const rightTime = right ? new Date(right).getTime() : Number.NEGATIVE_INFINITY;
  return dir === "asc" ? leftTime - rightTime : rightTime - leftTime;
};

const SOFT_DELETE_RETENTION_DAYS = 30;
const ACTIVE_PROJECT_WHERE = {
  deletedAt: null,
  purgedAt: null,
} as const;

const addDays = (value: Date, days: number) => {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
};

const assertProjectNotDeleted = (
  project: { deletedAt: Date | null; purgedAt: Date | null },
  message = "Project is in Recently Deleted. Restore it before making changes."
) => {
  if (project.purgedAt) {
    throw new AppError(404, "NOT_FOUND", "Project not found");
  }
  if (project.deletedAt) {
    throw new AppError(409, "PROJECT_DELETED", message);
  }
};

export async function purgeExpiredDeletedProjects() {
  const now = new Date();
  await prisma.project.updateMany({
    where: {
      deletedAt: { not: null },
      purgedAt: null,
      deletePurgeAt: { lte: now },
    },
    data: {
      purgedAt: now,
    },
  });
}

const promoteImportedProjectSubmissions = async (projectId: number) => {
  const submissions = await prisma.submission.findMany({
    where: {
      projectId,
      sequenceNumber: 1,
    },
    select: { id: true },
  });

  if (submissions.length === 0) {
    return;
  }

  await promoteImportedSubmissionsToWorkflow({
    submissionIds: submissions.map((submission) => submission.id),
  });
};

const LEGACY_SYNC_STATUS_TARGETS = new Set<SubmissionStatus>([
  SubmissionStatus.RECEIVED,
  SubmissionStatus.UNDER_COMPLETENESS_CHECK,
  SubmissionStatus.RETURNED_FOR_COMPLETION,
  SubmissionStatus.NOT_ACCEPTED,
  SubmissionStatus.AWAITING_CLASSIFICATION,
  SubmissionStatus.UNDER_CLASSIFICATION,
  SubmissionStatus.CLASSIFIED,
  SubmissionStatus.UNDER_REVIEW,
  SubmissionStatus.AWAITING_REVISIONS,
  SubmissionStatus.REVISION_SUBMITTED,
  SubmissionStatus.CLOSED,
  SubmissionStatus.WITHDRAWN,
]);

const LEGACY_REVIEW_ASSIGNMENT_STATUSES = new Set<SubmissionStatus>([
  SubmissionStatus.CLASSIFIED,
  SubmissionStatus.UNDER_REVIEW,
  SubmissionStatus.AWAITING_REVISIONS,
  SubmissionStatus.REVISION_SUBMITTED,
  SubmissionStatus.CLOSED,
]);

const normalizeReviewTypeFromLegacyText = (
  value: string | null | undefined
): ReviewType | null => {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes("exempt")) return ReviewType.EXEMPT;
  if (raw.includes("expedit")) return ReviewType.EXPEDITED;
  if (raw.includes("full")) return ReviewType.FULL_BOARD;
  return null;
};

const normalizeSubmissionStatusFromLegacyText = (
  value: string | null | undefined
): SubmissionStatus | null => {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes("withdraw")) return SubmissionStatus.WITHDRAWN;
  if (raw.includes("not accepted") || raw.includes("beyond jurisdiction")) {
    return SubmissionStatus.NOT_ACCEPTED;
  }
  if (raw.includes("return") && raw.includes("completion")) {
    return SubmissionStatus.RETURNED_FOR_COMPLETION;
  }
  if (raw.includes("completeness") || raw.includes("screen")) {
    return SubmissionStatus.UNDER_COMPLETENESS_CHECK;
  }
  if (raw.includes("awaiting classification")) return SubmissionStatus.AWAITING_CLASSIFICATION;
  if (raw.includes("under classification")) return SubmissionStatus.UNDER_CLASSIFICATION;
  if (raw.includes("classification")) return SubmissionStatus.CLASSIFIED;
  if (raw.includes("revision submitted")) return SubmissionStatus.REVISION_SUBMITTED;
  if (raw.includes("revision")) return SubmissionStatus.AWAITING_REVISIONS;
  if (raw.includes("under review")) return SubmissionStatus.UNDER_REVIEW;
  if (
    raw.includes("clear") ||
    raw.includes("approved") ||
    raw.includes("finish") ||
    raw.includes("closed") ||
    raw.includes("complete")
  ) {
    return SubmissionStatus.CLOSED;
  }
  if (raw.includes("exempt")) return SubmissionStatus.CLASSIFIED;
  if (raw.includes("expedit") || raw.includes("full")) return SubmissionStatus.UNDER_REVIEW;
  return null;
};

const getActiveSlaContext = async (tx: Prisma.TransactionClient, committeeId: number) => {
  const [configs, holidayRows] = await Promise.all([
    tx.configSLA.findMany({
      where: {
        committeeId,
        isActive: true,
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
    tx.holiday.findMany({
      select: { date: true },
    }),
  ]);

  return {
    configMap: buildSlaConfigMap(configs),
    holidayDates: holidayRows.map((row) => row.date),
  };
};

const resolveLegacyWorkflowTargetStatus = (params: {
  rawStatus: string | null;
  reviewType: ReviewType | null;
  withdrawn: boolean | null;
  finishDate: Date | null;
}) => {
  if (params.withdrawn === true) return SubmissionStatus.WITHDRAWN;
  const parsed = normalizeSubmissionStatusFromLegacyText(params.rawStatus);
  if (parsed) return parsed;
  if (params.finishDate) return SubmissionStatus.CLOSED;
  if (params.reviewType === ReviewType.EXEMPT) return SubmissionStatus.CLASSIFIED;
  if (
    params.reviewType === ReviewType.EXPEDITED ||
    params.reviewType === ReviewType.FULL_BOARD
  ) {
    return SubmissionStatus.UNDER_REVIEW;
  }
  return SubmissionStatus.AWAITING_CLASSIFICATION;
};

const isLegacyWorkflowSyncRequested = (data: {
  status: string | null;
  typeOfReview: string | null;
  classificationOfProposalRerc: string | null;
  withdrawn: boolean | null;
  finishDate: Date | null;
  panel: string | null;
  primaryReviewer: string | null;
  scientistReviewer: string | null;
  layReviewer: string | null;
  finalLayReviewer: string | null;
  independentConsultant: string | null;
}) =>
  Boolean(
    data.status ||
      data.typeOfReview ||
      data.classificationOfProposalRerc ||
      data.primaryReviewer ||
      data.scientistReviewer ||
      data.layReviewer ||
      data.finalLayReviewer ||
      data.independentConsultant ||
      data.finishDate ||
      data.withdrawn === true
  );

export type LegacyWorkflowSyncPayload = {
  status: string | null;
  typeOfReview: string | null;
  classificationOfProposalRerc: string | null;
  withdrawn: boolean | null;
  finishDate: Date | null;
  dateOfSubmission: Date | null;
  panel: string | null;
  primaryReviewer: string | null;
  scientistReviewer: string | null;
  layReviewer: string | null;
  finalLayReviewer: string | null;
  independentConsultant: string | null;
};

export const syncLegacyProfileToWorkflow = async (
  tx: Prisma.TransactionClient,
  params: {
    projectId: number;
    committeeId: number;
    projectStatus: ProjectStatus;
    sourceSubmissionId: number | null;
    changedById: number;
    data: LegacyWorkflowSyncPayload;
  }
) => {
  if (!isLegacyWorkflowSyncRequested(params.data)) {
    return;
  }

  const sourceSubmission = params.sourceSubmissionId
    ? await tx.submission.findFirst({
        where: {
          id: params.sourceSubmissionId,
          projectId: params.projectId,
        },
        include: {
          classification: true,
          reviews: true,
        },
      })
    : null;

  const submission =
    sourceSubmission ??
    (await tx.submission.findFirst({
      where: { projectId: params.projectId },
      orderBy: [{ sequenceNumber: "asc" }, { id: "asc" }],
      include: {
        classification: true,
        reviews: true,
      },
    }));

  if (!submission) {
    return;
  }

  const reviewType =
    normalizeReviewTypeFromLegacyText(params.data.typeOfReview) ??
    normalizeReviewTypeFromLegacyText(params.data.classificationOfProposalRerc);
  let targetStatus = resolveLegacyWorkflowTargetStatus({
    rawStatus: params.data.status,
    reviewType,
    withdrawn: params.data.withdrawn,
    finishDate: params.data.finishDate,
  });
  if (reviewType === ReviewType.EXEMPT && targetStatus === SubmissionStatus.UNDER_REVIEW) {
    targetStatus = SubmissionStatus.CLASSIFIED;
  }
  if (!reviewType && targetStatus === SubmissionStatus.UNDER_REVIEW) {
    targetStatus = SubmissionStatus.CLASSIFIED;
  }
  if (!LEGACY_SYNC_STATUS_TARGETS.has(targetStatus)) {
    return;
  }

  const { configMap, holidayDates } = await getActiveSlaContext(tx, params.committeeId);
  const now = new Date();
  const classificationDate =
    submission.classification?.classificationDate ??
    params.data.dateOfSubmission ??
    now;

  let panelId = submission.classification?.panelId ?? null;
  const panelText = asNullableString(params.data.panel);
  if (panelText) {
    const panel = await tx.panel.findFirst({
      where: {
        committeeId: params.committeeId,
        OR: [
          { name: { equals: panelText, mode: "insensitive" } },
          { code: { equals: panelText, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    panelId = panel?.id ?? panelId;
  }

  if (reviewType) {
    await tx.classification.upsert({
      where: { submissionId: submission.id },
      update: {
        reviewType,
        classificationDate,
        panelId,
      },
      create: {
        submissionId: submission.id,
        reviewType,
        classificationDate,
        panelId,
        classifiedById: params.changedById,
      },
    });
  }

  const resolveReviewerUserId = async (label: string | null) => {
    const normalized = asNullableString(label);
    if (!normalized) return null;
    const user = await tx.user.findFirst({
      where: {
        isActive: true,
        status: UserStatus.APPROVED,
        OR: [
          { fullName: { equals: normalized, mode: "insensitive" } },
          { email: { equals: normalized, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    return user?.id ?? null;
  };

  const reviewSlaConfig =
    reviewType === ReviewType.EXPEDITED || reviewType === ReviewType.FULL_BOARD
      ? getConfiguredSlaOrDefault(
          configMap,
          params.committeeId,
          SLAStage.REVIEW,
          reviewType
        )
      : null;
  const reviewDueDate = reviewSlaConfig
    ? computeDueDate(
        reviewSlaConfig.dayMode,
        now,
        reviewSlaConfig.targetDays,
        holidayDates
      )
    : null;

  const upsertReviewer = async (
    reviewerId: number,
    reviewerRole: ReviewerRoleType,
    assignmentRole: ReviewerRoundRole | null,
    isPrimary: boolean
  ) => {
    await tx.review.upsert({
      where: {
        submissionId_reviewerId: {
          submissionId: submission.id,
          reviewerId,
        },
      },
      update: {
        reviewerRole,
        isPrimary,
        dueDate: reviewDueDate,
      },
      create: {
        submissionId: submission.id,
        reviewerId,
        reviewerRole,
        isPrimary,
        dueDate: reviewDueDate,
      },
    });

    if (!assignmentRole) return;

    await tx.reviewAssignment.upsert({
      where: {
        submissionId_roundSequence_reviewerRole: {
          submissionId: submission.id,
          roundSequence: submission.sequenceNumber,
          reviewerRole: assignmentRole,
        },
      },
      update: {
        reviewerId,
        dueDate: reviewDueDate,
        isActive: true,
        endedAt: null,
        submittedAt: null,
      },
      create: {
        submissionId: submission.id,
        roundSequence: submission.sequenceNumber,
        reviewerId,
        reviewerRole: assignmentRole,
        dueDate: reviewDueDate,
      },
    });
  };

  if (
    reviewType &&
    reviewType !== ReviewType.EXEMPT &&
    LEGACY_REVIEW_ASSIGNMENT_STATUSES.has(targetStatus)
  ) {
    const scientificReviewerId = await resolveReviewerUserId(
      params.data.primaryReviewer ?? params.data.scientistReviewer
    );
    if (scientificReviewerId) {
      await upsertReviewer(
        scientificReviewerId,
        ReviewerRoleType.SCIENTIST,
        ReviewerRoundRole.SCIENTIFIC,
        true
      );
    }

    const layReviewerId = await resolveReviewerUserId(
      params.data.finalLayReviewer ?? params.data.layReviewer
    );
    if (layReviewerId) {
      await upsertReviewer(
        layReviewerId,
        ReviewerRoleType.LAY,
        ReviewerRoundRole.LAY,
        false
      );
    }

    const consultantReviewerId = await resolveReviewerUserId(
      params.data.independentConsultant
    );
    if (consultantReviewerId) {
      await upsertReviewer(
        consultantReviewerId,
        ReviewerRoleType.INDEPENDENT_CONSULTANT,
        null,
        false
      );
    }
  }

  const classificationSlaConfig = getConfiguredSlaOrDefault(
    configMap,
    params.committeeId,
    SLAStage.CLASSIFICATION,
    null
  );
  const revisionSlaConfig = getConfiguredSlaOrDefault(
    configMap,
    params.committeeId,
    SLAStage.REVISION_RESPONSE,
    null
  );
  const exemptNotificationConfig =
    reviewType === ReviewType.EXEMPT
      ? getConfiguredSlaOrDefault(
          configMap,
          params.committeeId,
          SLAStage.EXEMPT_NOTIFICATION,
          ReviewType.EXEMPT
        )
      : null;

  const statusChanged = submission.status !== targetStatus;
  const resultsNotifiedAt =
    targetStatus === SubmissionStatus.AWAITING_REVISIONS ||
    targetStatus === SubmissionStatus.REVISION_SUBMITTED ||
    targetStatus === SubmissionStatus.CLOSED
      ? submission.resultsNotifiedAt ?? params.data.finishDate ?? now
      : submission.resultsNotifiedAt;

  await tx.submission.update({
    where: { id: submission.id },
    data: {
      status: targetStatus,
      classificationDueDate:
        targetStatus === SubmissionStatus.AWAITING_CLASSIFICATION ||
        targetStatus === SubmissionStatus.UNDER_CLASSIFICATION
          ? classificationSlaConfig
            ? computeDueDate(
                classificationSlaConfig.dayMode,
                now,
                classificationSlaConfig.targetDays,
                holidayDates
              )
            : null
          : null,
      exemptNotificationDueDate:
        targetStatus === SubmissionStatus.CLASSIFIED &&
        reviewType === ReviewType.EXEMPT &&
        exemptNotificationConfig
          ? computeDueDate(
              exemptNotificationConfig.dayMode,
              classificationDate,
              exemptNotificationConfig.targetDays,
              holidayDates
            )
          : null,
      revisionDueDate:
        targetStatus === SubmissionStatus.AWAITING_REVISIONS
          ? revisionSlaConfig
            ? computeDueDate(
                revisionSlaConfig.dayMode,
                resultsNotifiedAt ?? now,
                revisionSlaConfig.targetDays,
                holidayDates
              )
            : null
          : targetStatus === SubmissionStatus.REVISION_SUBMITTED
            ? submission.revisionDueDate
            : null,
      resultsNotifiedAt,
      finalDecision:
        targetStatus === SubmissionStatus.CLOSED
          ? submission.finalDecision ?? ReviewDecision.APPROVED
          : targetStatus === SubmissionStatus.WITHDRAWN
            ? null
            : submission.finalDecision,
      finalDecisionDate:
        targetStatus === SubmissionStatus.CLOSED
          ? submission.finalDecisionDate ?? params.data.finishDate ?? now
          : targetStatus === SubmissionStatus.WITHDRAWN
            ? null
            : submission.finalDecisionDate,
    },
  });

  if (statusChanged) {
    await tx.submissionStatusHistory.create({
      data: {
        submissionId: submission.id,
        oldStatus: submission.status,
        newStatus: targetStatus,
        reason: "Synchronized from legacy protocol profile fields.",
        changedById: params.changedById,
      },
    });
  }

  const nextProjectStatus =
    targetStatus === SubmissionStatus.CLOSED
      ? ProjectStatus.CLOSED
      : targetStatus === SubmissionStatus.WITHDRAWN
        ? ProjectStatus.WITHDRAWN
        : params.projectStatus;

  if (nextProjectStatus !== params.projectStatus) {
    await tx.project.update({
      where: { id: params.projectId },
      data: { overallStatus: nextProjectStatus },
    });
  }
};

/* ------------------------------------------------------------------ */
/*  List projects                                                      */
/* ------------------------------------------------------------------ */
export async function listProjects() {
  return prisma.project.findMany({
    where: ACTIVE_PROJECT_WHERE,
    orderBy: { createdAt: "desc" },
    include: { committee: true, createdBy: true },
  });
}

/* ------------------------------------------------------------------ */
/*  Search projects                                                    */
/* ------------------------------------------------------------------ */
export async function searchProjects(
  query: string,
  limit: number,
  committeeCode: string | null
) {
  if (!query) return { items: [] };

  const tokens = query.split(/\s+/).filter(Boolean);

  const titleHistory = await prisma.projectChangeLog.findMany({
    where: {
      fieldName: "title",
      OR: [
        { oldValue: { contains: query, mode: "insensitive" } },
        { newValue: { contains: query, mode: "insensitive" } },
      ],
    },
    select: { projectId: true },
    take: 25,
  });
  const titleHistoryIds = titleHistory.map((row) => row.projectId);

  const projects = await prisma.project.findMany({
    where: {
      ...ACTIVE_PROJECT_WHERE,
      ...(committeeCode ? { committee: { code: committeeCode } } : {}),
      OR: [
        { projectCode: { contains: query, mode: "insensitive" } },
        { title: { contains: query, mode: "insensitive" } },
        { piName: { contains: query, mode: "insensitive" } },
        { piSurname: { contains: query, mode: "insensitive" } },
        ...(tokens.length > 0 ? [{ keywords: { hasSome: tokens } }] : []),
        ...(titleHistoryIds.length > 0 ? [{ id: { in: titleHistoryIds } }] : []),
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true, projectCode: true, title: true, piName: true, updatedAt: true,
      origin: true,
    },
  });

  return { items: projects };
}

/* ------------------------------------------------------------------ */
/*  Archived projects                                                  */
/* ------------------------------------------------------------------ */
export async function getArchivedProjects(params: {
  committeeCode?: string | null;
  limit: number;
  offset: number;
  search?: string | null;
  statusFilter?: string | null;
  reviewTypeFilter?: string | null;
  collegeFilter?: string | null;
  sortBy?: "lastModified" | "submitted";
  sortDir?: "asc" | "desc";
}) {
  await purgeExpiredDeletedProjects();

  const {
    committeeCode,
    limit,
    offset,
    search,
    statusFilter,
    reviewTypeFilter,
    collegeFilter,
    sortBy = "lastModified",
    sortDir = "desc",
  } = params;
  const archiveStatuses = normalizeArchiveProjectStatus(statusFilter)
    ? [normalizeArchiveProjectStatus(statusFilter)!]
    : [...ARCHIVED_PROJECT_STATUSES];

  const whereClause: any = {
    ...ACTIVE_PROJECT_WHERE,
    overallStatus: { in: archiveStatuses },
  };

  if (committeeCode) whereClause.committee = { code: committeeCode };
  if (collegeFilter) whereClause.piAffiliation = { equals: collegeFilter, mode: "insensitive" };
  if (search) {
    whereClause.OR = [
      { projectCode: { contains: search, mode: "insensitive" } },
      { title: { contains: search, mode: "insensitive" } },
      { piName: { contains: search, mode: "insensitive" } },
    ];
  }

  const projects = await prisma.project.findMany({
    where: whereClause,
    include: {
      submissions: {
        orderBy: [{ sequenceNumber: "desc" }, { id: "desc" }],
        take: 1,
        include: { classification: { select: { reviewType: true } } },
      },
      committee: { select: { code: true, name: true } },
      statusHistory: {
        where: { newStatus: { in: ARCHIVED_PROJECT_STATUSES as unknown as ProjectStatus[] } },
        orderBy: [{ effectiveDate: "desc" }, { id: "desc" }],
        take: 1,
      },
    },
  });

  const archivedProjects = projects.filter((project) => {
    const latestSubmission = project.submissions[0];
    if (!latestSubmission) return false;
    if (reviewTypeFilter && latestSubmission.classification?.reviewType !== reviewTypeFilter) {
      return false;
    }
    return (
      project.overallStatus === ProjectStatus.CLOSED ||
      project.overallStatus === ProjectStatus.WITHDRAWN
    ) && archiveStatuses.includes(project.overallStatus as (typeof ARCHIVED_PROJECT_STATUSES)[number]);
  });

  archivedProjects.sort((left, right) => {
    if (sortBy === "submitted") {
      const leftReceived = left.submissions[0]?.receivedDate ?? left.initialSubmissionDate;
      const rightReceived = right.submissions[0]?.receivedDate ?? right.initialSubmissionDate;
      return compareNullableDates(leftReceived, rightReceived, sortDir);
    }
    return compareNullableDates(left.updatedAt, right.updatedAt, sortDir);
  });

  const items = archivedProjects.slice(offset, offset + limit).map((project) => {
    const latestSubmission = project.submissions[0];
    const archiveEvent = project.statusHistory[0];
    return {
      projectId: project.id,
      projectCode: project.projectCode,
      title: project.title,
      piName: project.piName,
      latestSubmissionId: latestSubmission?.id ?? null,
      latestSubmissionStatus: latestSubmission?.status ?? null,
      receivedDate: latestSubmission?.receivedDate ?? project.initialSubmissionDate,
      reviewType: latestSubmission?.classification?.reviewType ?? null,
      committeeCode: project.committee?.code ?? null,
      overallStatus: project.overallStatus,
      archiveDate: archiveEvent?.effectiveDate ?? null,
      archiveReason: archiveEvent?.reason ?? null,
    };
  });

  return { items, total: archivedProjects.length, limit, offset };
}

/* ------------------------------------------------------------------ */
/*  Get project by ID                                                  */
/* ------------------------------------------------------------------ */
export async function getProjectById(id: number) {
  await promoteImportedProjectSubmissions(id);
  const project = await prisma.project.findFirst({
    where: {
      id,
      ...ACTIVE_PROJECT_WHERE,
    },
    include: {
      committee: true,
      createdBy: true,
      legacyImportSnapshot: {
        include: {
          importBatch: {
            select: {
              id: true,
              mode: true,
              sourceFilename: true,
              createdAt: true,
            },
          },
        },
      },
      submissions: { orderBy: { sequenceNumber: "asc" } },
    },
  });
  if (!project) throw new AppError(404, "NOT_FOUND", "Project not found");
  return project;
}

/* ------------------------------------------------------------------ */
/*  Get full project lifecycle                                         */
/* ------------------------------------------------------------------ */
export async function getProjectFull(id: number) {
  await promoteImportedProjectSubmissions(id);
  const project = await prisma.project.findFirst({
    where: {
      id,
      ...ACTIVE_PROJECT_WHERE,
    },
    include: {
      committee: true,
      createdBy: true,
      protocolProfile: true,
      legacyImportSnapshot: {
        include: {
          importBatch: {
            select: {
              id: true,
              mode: true,
              sourceFilename: true,
              createdAt: true,
            },
          },
        },
      },
      protocolMilestones: { orderBy: [{ orderIndex: "asc" }, { id: "asc" }] },
      changeLog: {
        orderBy: { createdAt: "desc" },
        include: { changedBy: true },
      },
      statusHistory: {
        orderBy: [{ effectiveDate: "desc" }, { id: "desc" }],
        include: { changedBy: true },
      },
      submissions: {
        orderBy: [{ receivedDate: "asc" }, { id: "asc" }],
        include: {
          classification: true,
          reviews: { include: { reviewer: true } },
          statusHistory: {
            orderBy: { effectiveDate: "asc" },
            include: { changedBy: true },
          },
        },
      },
    },
  });
  if (!project) throw new AppError(404, "NOT_FOUND", "Project not found");
  return project;
}

export async function archiveProject(
  projectId: number,
  mode: "CLOSED" | "WITHDRAWN",
  reason: string,
  actorId: number
) {
  await purgeExpiredDeletedProjects();

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new AppError(400, "REASON_REQUIRED", "Archive reason is required");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      overallStatus: true,
      deletedAt: true,
      purgedAt: true,
      submissions: {
        orderBy: [{ sequenceNumber: "desc" }, { id: "desc" }],
        take: 1,
        select: { id: true, status: true },
      },
    },
  });

  if (!project) {
    throw new AppError(404, "NOT_FOUND", "Project not found");
  }
  assertProjectNotDeleted(project);

  if (ARCHIVED_PROJECT_STATUSES.includes(project.overallStatus as (typeof ARCHIVED_PROJECT_STATUSES)[number])) {
    throw new AppError(409, "ALREADY_ARCHIVED", "Project is already archived");
  }

  const latestSubmission = project.submissions[0];
  if (!latestSubmission) {
    throw new AppError(400, "NO_SUBMISSIONS", "Project must have a submission before it can be archived");
  }

  if (mode === ProjectStatus.CLOSED && latestSubmission.status !== SubmissionStatus.CLOSED) {
    throw new AppError(400, "ARCHIVE_NOT_ALLOWED", "Latest submission must be closed before archiving as completed");
  }

  if (mode === ProjectStatus.WITHDRAWN && latestSubmission.status !== SubmissionStatus.WITHDRAWN) {
    throw new AppError(400, "ARCHIVE_NOT_ALLOWED", "Latest submission must be withdrawn before archiving as withdrawn");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const history = await tx.projectStatusHistory.create({
      data: {
        projectId,
        oldStatus: project.overallStatus,
        newStatus: mode as ProjectStatus,
        reason: trimmedReason,
        changedById: actorId,
      },
      include: {
        changedBy: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    });

    const nextProject = await tx.project.update({
      where: { id: projectId },
      data: { overallStatus: mode as ProjectStatus },
      select: {
        id: true,
        overallStatus: true,
      },
    });

    return { project: nextProject, history };
  });

  return updated;
}

export async function restoreProjectArchive(
  projectId: number,
  reason: string,
  actorId: number
) {
  await purgeExpiredDeletedProjects();

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new AppError(400, "REASON_REQUIRED", "Restore reason is required");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      overallStatus: true,
      deletedAt: true,
      purgedAt: true,
    },
  });

  if (!project) {
    throw new AppError(404, "NOT_FOUND", "Project not found");
  }
  assertProjectNotDeleted(project);

  if (!ARCHIVED_PROJECT_STATUSES.includes(project.overallStatus as (typeof ARCHIVED_PROJECT_STATUSES)[number])) {
    throw new AppError(400, "NOT_ARCHIVED", "Project is not currently archived");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const history = await tx.projectStatusHistory.create({
      data: {
        projectId,
        oldStatus: project.overallStatus,
        newStatus: ProjectStatus.ACTIVE,
        reason: trimmedReason,
        changedById: actorId,
      },
      include: {
        changedBy: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    });

    const nextProject = await tx.project.update({
      where: { id: projectId },
      data: { overallStatus: ProjectStatus.ACTIVE },
      select: {
        id: true,
        overallStatus: true,
      },
    });

    return { project: nextProject, history };
  });

  return updated;
}

export async function deleteProjectRecord(
  projectId: number,
  reason: string,
  actorId: number
) {
  await purgeExpiredDeletedProjects();

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new AppError(400, "REASON_REQUIRED", "Delete reason is required");
  }

  const now = new Date();
  const purgeAt = addDays(now, SOFT_DELETE_RETENTION_DAYS);

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      purgedAt: null,
    },
    select: {
      id: true,
      overallStatus: true,
      deletedAt: true,
      purgedAt: true,
    },
  });

  if (!project) {
    throw new AppError(404, "NOT_FOUND", "Project not found");
  }

  if (project.deletedAt) {
    throw new AppError(409, "ALREADY_DELETED", "Project is already in Recently Deleted");
  }

  const updatedProject = await prisma.project.update({
    where: { id: projectId },
    data: {
      deletedAt: now,
      deletedById: actorId,
      deletedReason: trimmedReason,
      deletedFromStatus: project.overallStatus,
      deletePurgeAt: purgeAt,
      purgedAt: null,
    },
    select: {
      id: true,
      overallStatus: true,
      deletedAt: true,
      deletePurgeAt: true,
      deletedReason: true,
      deletedFromStatus: true,
      deletedBy: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  });

  return { project: updatedProject };
}

export async function restoreDeletedProjectRecord(
  projectId: number,
  reason: string,
  targetStatus: ProjectStatus,
  actorId: number
) {
  await purgeExpiredDeletedProjects();

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new AppError(400, "REASON_REQUIRED", "Restore reason is required");
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      purgedAt: null,
    },
    select: {
      id: true,
      overallStatus: true,
      deletedAt: true,
      purgedAt: true,
    },
  });

  if (!project) {
    throw new AppError(404, "NOT_FOUND", "Project not found");
  }

  if (!project.deletedAt) {
    throw new AppError(400, "NOT_DELETED", "Project is not in Recently Deleted");
  }

  const restored = await prisma.$transaction(async (tx) => {
    const nextProject = await tx.project.update({
      where: { id: projectId },
      data: {
        overallStatus: targetStatus,
        deletedAt: null,
        deletedById: null,
        deletedReason: null,
        deletedFromStatus: null,
        deletePurgeAt: null,
        purgedAt: null,
      },
      select: {
        id: true,
        overallStatus: true,
      },
    });

    const history = await tx.projectStatusHistory.create({
      data: {
        projectId,
        oldStatus: project.overallStatus,
        newStatus: targetStatus,
        reason: trimmedReason,
        changedById: actorId,
      },
      include: {
        changedBy: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    });

    return { project: nextProject, history };
  });

  return restored;
}

export async function getRecentlyDeletedProjects(params: {
  committeeCode?: string | null;
  limit: number;
  offset: number;
  search?: string | null;
  statusFilter?: string | null;
  reviewTypeFilter?: string | null;
  collegeFilter?: string | null;
  sortBy?: "lastModified" | "submitted";
  sortDir?: "asc" | "desc";
}) {
  await purgeExpiredDeletedProjects();

  const {
    committeeCode,
    limit,
    offset,
    search,
    statusFilter,
    reviewTypeFilter,
    collegeFilter,
    sortBy = "lastModified",
    sortDir = "desc",
  } = params;

  const normalizedStatusFilter =
    Object.values(ProjectStatus).includes(statusFilter as ProjectStatus)
      ? (statusFilter as ProjectStatus)
      : null;

  const whereClause: Prisma.ProjectWhereInput = {
    deletedAt: { not: null },
    purgedAt: null,
    ...(normalizedStatusFilter ? { deletedFromStatus: normalizedStatusFilter } : {}),
    ...(committeeCode ? { committee: { code: committeeCode } } : {}),
    ...(collegeFilter ? { piAffiliation: { equals: collegeFilter, mode: "insensitive" } } : {}),
    ...(search
      ? {
          OR: [
            { projectCode: { contains: search, mode: "insensitive" } },
            { title: { contains: search, mode: "insensitive" } },
            { piName: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const projects = await prisma.project.findMany({
    where: whereClause,
    include: {
      submissions: {
        orderBy: [{ sequenceNumber: "desc" }, { id: "desc" }],
        take: 1,
        include: { classification: { select: { reviewType: true } } },
      },
      committee: { select: { code: true, name: true } },
      deletedBy: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  });

  const filtered = projects.filter((project) => {
    const latestSubmission = project.submissions[0];
    if (reviewTypeFilter && latestSubmission?.classification?.reviewType !== reviewTypeFilter) {
      return false;
    }
    return true;
  });

  filtered.sort((left, right) => {
    if (sortBy === "submitted") {
      const leftReceived = left.submissions[0]?.receivedDate ?? left.initialSubmissionDate;
      const rightReceived = right.submissions[0]?.receivedDate ?? right.initialSubmissionDate;
      return compareNullableDates(leftReceived, rightReceived, sortDir);
    }
    return compareNullableDates(left.deletedAt ?? left.updatedAt, right.deletedAt ?? right.updatedAt, sortDir);
  });

  const items = filtered.slice(offset, offset + limit).map((project) => {
    const latestSubmission = project.submissions[0];
    return {
      projectId: project.id,
      projectCode: project.projectCode,
      title: project.title,
      piName: project.piName,
      latestSubmissionId: latestSubmission?.id ?? null,
      latestSubmissionStatus: latestSubmission?.status ?? null,
      receivedDate: latestSubmission?.receivedDate ?? project.initialSubmissionDate,
      reviewType: latestSubmission?.classification?.reviewType ?? null,
      committeeCode: project.committee?.code ?? null,
      overallStatus: project.overallStatus,
      deletedAt: project.deletedAt,
      deletedReason: project.deletedReason,
      deletedFromStatus: project.deletedFromStatus,
      deletePurgeAt: project.deletePurgeAt,
      purgedAt: project.purgedAt,
      deletedBy: project.deletedBy
        ? {
            id: project.deletedBy.id,
            fullName: project.deletedBy.fullName,
            email: project.deletedBy.email,
          }
        : null,
    };
  });

  return { items, total: filtered.length, limit, offset };
}

/* ------------------------------------------------------------------ */
/*  Get profile + milestones                                           */
/* ------------------------------------------------------------------ */
export async function getProjectProfile(projectId: number) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ...ACTIVE_PROJECT_WHERE,
    },
    select: {
      id: true,
      origin: true,
      protocolProfile: true,
      legacyImportSnapshot: {
        include: {
          importBatch: {
            select: {
              id: true,
              mode: true,
              sourceFilename: true,
              createdAt: true,
            },
          },
        },
      },
      protocolMilestones: { orderBy: [{ orderIndex: "asc" }, { id: "asc" }] },
    },
  });
  if (!project) throw new AppError(404, "NOT_FOUND", "Project not found");
  return {
    origin: project.origin,
    profile: project.protocolProfile,
    legacyImportSnapshot: project.legacyImportSnapshot,
    milestones: project.protocolMilestones,
  };
}

/* ------------------------------------------------------------------ */
/*  Upsert profile                                                     */
/* ------------------------------------------------------------------ */
export async function upsertProjectProfile(
  projectId: number,
  payload: Record<string, any>,
  userId: number
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      committeeId: true,
      overallStatus: true,
      deletedAt: true,
      purgedAt: true,
    },
  });
  if (!project) throw new AppError(404, "NOT_FOUND", "Project not found");
  assertProjectNotDeleted(project);

  const changeReason = asNullableString(payload._meta?.changeReason);
  const sourceSubmissionId = payload._meta?.sourceSubmissionId
    ? Number(payload._meta.sourceSubmissionId) : null;
  const changedById = userId;

  const data = {
    title: asNullableString(payload.title),
    projectLeader: asNullableString(payload.projectLeader),
    college: asNullableString(payload.college),
    department: asNullableString(payload.department),
    dateOfSubmission: asNullableDate(payload.dateOfSubmission),
    monthOfSubmission: asNullableString(payload.monthOfSubmission),
    typeOfReview: asNullableString(payload.typeOfReview),
    proponent: asNullableString(payload.proponent),
    funding: asNullableString(payload.funding),
    typeOfResearchPhreb: asNullableString(payload.typeOfResearchPhreb),
    typeOfResearchPhrebOther: asNullableString(payload.typeOfResearchPhrebOther),
    status: asNullableString(payload.status),
    finishDate: asNullableDate(payload.finishDate),
    monthOfClearance: asNullableString(payload.monthOfClearance),
    reviewDurationDays: asNullableInt(payload.reviewDurationDays),
    remarks: asNullableString(payload.remarks),
    panel: asNullableString(payload.panel),
    scientistReviewer: asNullableString(payload.scientistReviewer),
    layReviewer: asNullableString(payload.layReviewer),
    independentConsultant: asNullableString(payload.independentConsultant),
    honorariumStatus: asNullableString(payload.honorariumStatus),
    classificationOfProposalRerc: asNullableString(payload.classificationOfProposalRerc),
    totalDays: asNullableInt(payload.totalDays),
    submissionCount: asNullableInt(payload.submissionCount),
    withdrawn: asNullableBoolean(payload.withdrawn),
    projectEndDate6A: asNullableDate(payload.projectEndDate6A),
    clearanceExpiration: asNullableDate(payload.clearanceExpiration),
    progressReportTargetDate: asNullableDate(payload.progressReportTargetDate),
    progressReportSubmission: asNullableDate(payload.progressReportSubmission),
    progressReportApprovalDate: asNullableDate(payload.progressReportApprovalDate),
    progressReportStatus: asNullableString(payload.progressReportStatus),
    progressReportDays: asNullableInt(payload.progressReportDays),
    finalReportTargetDate: asNullableDate(payload.finalReportTargetDate),
    finalReportSubmission: asNullableDate(payload.finalReportSubmission),
    finalReportCompletionDate: asNullableDate(payload.finalReportCompletionDate),
    finalReportStatus: asNullableString(payload.finalReportStatus),
    finalReportDays: asNullableInt(payload.finalReportDays),
    amendmentSubmission: asNullableDate(payload.amendmentSubmission),
    amendmentStatusOfRequest: asNullableString(payload.amendmentStatusOfRequest),
    amendmentApprovalDate: asNullableDate(payload.amendmentApprovalDate),
    amendmentDays: asNullableInt(payload.amendmentDays),
    continuingSubmission: asNullableDate(payload.continuingSubmission),
    continuingStatusOfRequest: asNullableString(payload.continuingStatusOfRequest),
    continuingApprovalDate: asNullableDate(payload.continuingApprovalDate),
    continuingDays: asNullableInt(payload.continuingDays),
    primaryReviewer: asNullableString(payload.primaryReviewer),
    finalLayReviewer: asNullableString(payload.finalLayReviewer),
  };

  const existing = await prisma.protocolProfile.findUnique({ where: { projectId } });

  const changeLogs: Array<{
    projectId: number; fieldName: string;
    oldValue: string | null; newValue: string | null;
    reason: string | null; sourceSubmissionId: number | null;
    changedById: number | null;
  }> = [];

  const serializeValue = (val: unknown): string | null => {
    if (val === null || val === undefined) return null;
    if (val instanceof Date) return val.toISOString();
    return String(val);
  };

  for (const [fieldName, newVal] of Object.entries(data)) {
    const oldRaw = existing ? (existing as Record<string, unknown>)[fieldName] : undefined;
    const oldSerialized = serializeValue(oldRaw);
    const newSerialized = serializeValue(newVal);
    if (oldSerialized !== newSerialized) {
      changeLogs.push({
        projectId, fieldName,
        oldValue: oldSerialized, newValue: newSerialized,
        reason: changeReason,
        sourceSubmissionId: sourceSubmissionId && Number.isFinite(sourceSubmissionId)
          ? sourceSubmissionId : null,
        changedById,
      });
    }
  }

  return prisma.$transaction(async (tx) => {
    const upserted = await tx.protocolProfile.upsert({
      where: { projectId },
      update: data,
      create: { projectId, ...data },
    });
    if (changeLogs.length > 0) {
      await tx.projectChangeLog.createMany({ data: changeLogs });
    }

    await syncLegacyProfileToWorkflow(tx, {
      projectId,
      committeeId: project.committeeId,
      projectStatus: project.overallStatus,
      sourceSubmissionId:
        sourceSubmissionId && Number.isFinite(sourceSubmissionId)
          ? sourceSubmissionId
          : null,
      changedById: changedById ?? userId,
      data: {
        status: data.status,
        typeOfReview: data.typeOfReview,
        classificationOfProposalRerc: data.classificationOfProposalRerc,
        withdrawn: data.withdrawn,
        finishDate: data.finishDate,
        dateOfSubmission: data.dateOfSubmission,
        panel: data.panel,
        primaryReviewer: data.primaryReviewer,
        scientistReviewer: data.scientistReviewer,
        layReviewer: data.layReviewer,
        finalLayReviewer: data.finalLayReviewer,
        independentConsultant: data.independentConsultant,
      },
    });

    return upserted;
  });
}

/* ------------------------------------------------------------------ */
/*  Milestones CRUD                                                    */
/* ------------------------------------------------------------------ */
export async function createMilestone(projectId: number, body: Record<string, any>) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      deletedAt: true,
      purgedAt: true,
    },
  });
  if (!project) throw new AppError(404, "NOT_FOUND", "Project not found");
  assertProjectNotDeleted(project);

  const label = asNullableString(body?.label);
  if (!label) throw new AppError(400, "VALIDATION_ERROR", "label is required");

  return prisma.protocolMilestone.create({
    data: {
      projectId,
      label,
      orderIndex: asNullableInt(body?.orderIndex) ?? 0,
      days: asNullableInt(body?.days),
      dateOccurred: asNullableDate(body?.dateOccurred),
      ownerRole: asNullableString(body?.ownerRole),
      notes: asNullableString(body?.notes),
    },
  });
}

export async function updateMilestone(
  projectId: number,
  milestoneId: number,
  body: Record<string, any>
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      deletedAt: true,
      purgedAt: true,
    },
  });
  if (!project) throw new AppError(404, "NOT_FOUND", "Project not found");
  assertProjectNotDeleted(project);

  const existing = await prisma.protocolMilestone.findUnique({
    where: { id: milestoneId },
    select: { id: true, projectId: true },
  });
  if (!existing || existing.projectId !== projectId) {
    throw new AppError(404, "NOT_FOUND", "Milestone not found");
  }

  return prisma.protocolMilestone.update({
    where: { id: milestoneId },
    data: {
      label: asNullableString(body?.label) ?? undefined,
      orderIndex: asNullableInt(body?.orderIndex) ?? undefined,
      days: body?.days === undefined ? undefined : asNullableInt(body?.days),
      dateOccurred: body?.dateOccurred === undefined ? undefined : asNullableDate(body?.dateOccurred),
      ownerRole: body?.ownerRole === undefined ? undefined : asNullableString(body?.ownerRole),
      notes: body?.notes === undefined ? undefined : asNullableString(body?.notes),
    },
  });
}

export async function deleteMilestone(projectId: number, milestoneId: number) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      deletedAt: true,
      purgedAt: true,
    },
  });
  if (!project) throw new AppError(404, "NOT_FOUND", "Project not found");
  assertProjectNotDeleted(project);

  const existing = await prisma.protocolMilestone.findUnique({
    where: { id: milestoneId },
    select: { id: true, projectId: true },
  });
  if (!existing || existing.projectId !== projectId) {
    throw new AppError(404, "NOT_FOUND", "Milestone not found");
  }
  await prisma.protocolMilestone.delete({ where: { id: milestoneId } });
  return { success: true };
}

/* ------------------------------------------------------------------ */
/*  Create submission for project                                      */
/* ------------------------------------------------------------------ */
export async function createSubmissionForProject(
  projectId: number,
  body: {
    submissionType: string;
    receivedDate?: string;
    documentLink?: string;
    completenessStatus?: string;
    completenessRemarks?: string;
    remarks?: string;
  },
  userId: number,
  options: {
    allowInitial?: boolean;
  } = {}
) {
  const allowedSubmissionTypes = options.allowInitial
    ? [
        "INITIAL", "RESUBMISSION", "AMENDMENT", "CONTINUING_REVIEW", "FINAL_REPORT",
        "WITHDRAWAL", "SAFETY_REPORT", "PROTOCOL_DEVIATION",
      ]
    : [
        "RESUBMISSION", "AMENDMENT", "CONTINUING_REVIEW", "FINAL_REPORT",
        "WITHDRAWAL", "SAFETY_REPORT", "PROTOCOL_DEVIATION",
      ];
  if (!body.submissionType) {
    throw new AppError(400, "VALIDATION_ERROR", "submissionType is required");
  }
  if (!allowedSubmissionTypes.includes(body.submissionType)) {
    throw new AppError(400, "INVALID_SUBMISSION_TYPE",
      `Invalid submissionType. Allowed: ${allowedSubmissionTypes.join(", ")}`);
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      projectCode: true,
      deletedAt: true,
      purgedAt: true,
    },
  });
  if (!project) {
    throw new AppError(404, "NOT_FOUND", "Project not found");
  }
  assertProjectNotDeleted(project);

  const allowedCompleteness = ["COMPLETE", "MINOR_MISSING", "MAJOR_MISSING", "MISSING_SIGNATURES", "OTHER"];
  if (body.completenessStatus && !allowedCompleteness.includes(body.completenessStatus)) {
    throw new AppError(400, "INVALID_COMPLETENESS",
      `Invalid completenessStatus. Allowed: ${allowedCompleteness.join(", ")}`);
  }

  const receivedAt = asNullableDate(body.receivedDate) ?? new Date();
  if (!receivedAt) {
    throw new AppError(400, "INVALID_DATE", "Invalid receivedDate");
  }

  return prisma.$transaction(async (tx) => {
    const lastSubmission = await tx.submission.findFirst({
      where: { projectId },
      orderBy: { sequenceNumber: "desc" },
      select: { sequenceNumber: true },
    });
    const sequenceNumber = (lastSubmission?.sequenceNumber ?? 0) + 1;

    const submission = await tx.submission.create({
      data: {
        projectId,
        submissionType: body.submissionType as SubmissionType,
        sequenceNumber,
        receivedDate: receivedAt,
        documentLink: body.documentLink,
        completenessStatus: (body.completenessStatus || "COMPLETE") as CompletenessStatus,
        completenessRemarks: body.completenessRemarks,
        remarks: body.remarks ?? body.completenessRemarks,
        status: SubmissionStatus.RECEIVED,
        createdById: userId,
      },
    });

    await tx.submissionStatusHistory.create({
      data: {
        submissionId: submission.id,
        oldStatus: null,
        newStatus: SubmissionStatus.RECEIVED,
        reason: `${body.submissionType} submission received`,
        changedById: userId,
      },
    });

    return submission;
  });
}
