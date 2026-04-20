/**
 * Submission service — business logic extracted from submissionRoutes.
 */
import prisma from "../../config/prismaClient";
import { logger } from "../../config/logger";
import {
  Prisma,
  ProjectStatus,
  ReminderTarget,
  ReviewDecision,
  ReviewerRoleType,
  ReviewerRoundRole,
  ReviewType,
  SLAStage,
  SubmissionDocumentStatus,
  SubmissionStatus,
  UserStatus,
  type SubmissionDocumentType,
} from "../../generated/prisma/client";
import { AppError } from "../../middleware/errorHandler";
import { logAuditEvent } from "../audit/auditService";
import {
  buildSlaConfigMap,
  buildSubmissionSlaSummary,
  computeDueDate,
  getConfiguredSlaOrDefault,
} from "../sla/submissionSlaService";
import { hasProjectSoftDeleteColumns } from "../../utils/projectSoftDelete";

const WORKFLOW_STAGE_ORDER: SubmissionStatus[] = [
  SubmissionStatus.AWAITING_CLASSIFICATION,
  SubmissionStatus.UNDER_CLASSIFICATION,
  SubmissionStatus.CLASSIFIED,
];

export type BulkStatusAction =
  | "START_COMPLETENESS_CHECK"
  | "RETURN_FOR_COMPLETION"
  | "MARK_NOT_ACCEPTED"
  | "ACCEPT_FOR_CLASSIFICATION"
  | "MOVE_TO_UNDER_CLASSIFICATION"
  | "MARK_CLASSIFIED"
  | "START_REVIEW";

type BulkResultStatus = "SUCCEEDED" | "SKIPPED" | "FAILED";

export interface BulkActionResult {
  submissionId: number;
  projectCode: string | null;
  status: BulkResultStatus;
  message: string;
  data?: Record<string, unknown> | null;
}

export interface BulkActionResponse {
  requestedCount: number;
  succeeded: number;
  skipped: number;
  failed: number;
  results: BulkActionResult[];
}

type BulkSubmissionContext = {
  id: number;
  status: SubmissionStatus;
  project: {
    projectCode: string | null;
    deletedAt?: Date | null;
    purgedAt?: Date | null;
  } | null;
  classification: {
    reviewType: ReviewType;
    panelId: number | null;
  } | null;
  reviews: Array<{ id: number }>;
};

const SKIPPABLE_ERROR_CODES = new Set([
  "NO_CHANGES",
  "INVALID_WORKFLOW_STAGE",
  "INVALID_TRANSITION",
  "NOT_CLASSIFIED",
  "INVALID_REVIEW_SETUP",
  "REVIEWER_REQUIRED",
  "PANEL_REQUIRED",
  "PROJECT_CODE_REQUIRED",
  "DUPLICATE_REVIEWER_ASSIGNMENT",
  "CLASSIFICATION_REQUIRED",
  "REASON_REQUIRED",
]);

const trimReason = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const requireReason = (value: string | null, actionLabel: string) => {
  if (!value) {
    throw new AppError(400, "REASON_REQUIRED", `${actionLabel} requires a reason`);
  }
  return value;
};

const assertProjectIsMutable = (
  project: { deletedAt?: Date | null; purgedAt?: Date | null } | null
) => {
  if (!project || project.purgedAt) {
    throw new AppError(404, "NOT_FOUND", "Submission not found");
  }
  if (project.deletedAt) {
    throw new AppError(
      409,
      "PROJECT_DELETED",
      "Project is in Recently Deleted. Restore it before making changes."
    );
  }
};

const submissionProjectDetailSelect: Prisma.ProjectSelect = {
  id: true,
  committeeId: true,
  projectCode: true,
  title: true,
  piName: true,
  piAffiliation: true,
  approvalStartDate: true,
  approvalEndDate: true,
  committee: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  protocolProfile: true,
  protocolMilestones: {
    orderBy: [{ orderIndex: "asc" }, { id: "asc" }],
  },
  submissions: {
    orderBy: [{ sequenceNumber: "asc" }, { id: "asc" }],
    select: {
      id: true,
      sequenceNumber: true,
      submissionType: true,
      status: true,
      receivedDate: true,
      createdAt: true,
    },
  },
};

const submissionProjectOverviewSelect: Prisma.ProjectSelect = {
  id: true,
  committeeId: true,
  piName: true,
};

const submissionProjectSlaSelect: Prisma.ProjectSelect = {
  committeeId: true,
  committee: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
};

const submissionProjectUpdateResultSelect: Prisma.ProjectSelect = {
  id: true,
  committeeId: true,
  projectCode: true,
  title: true,
  piName: true,
  piAffiliation: true,
  approvalStartDate: true,
  approvalEndDate: true,
  overallStatus: true,
  committee: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
};

const normalizeReviewerRoles = (value?: string | null) => {
  const normalized = String(value ?? "SCIENTIST")
    .trim()
    .toUpperCase();

  if (normalized === "LAY") {
    return {
      reviewRole: ReviewerRoleType.LAY,
      assignmentRole: ReviewerRoundRole.LAY,
    };
  }

  if (normalized === "INDEPENDENT_CONSULTANT" || normalized === "CONSULTANT") {
    return {
      reviewRole: ReviewerRoleType.INDEPENDENT_CONSULTANT,
      assignmentRole: null,
    };
  }

  return {
    reviewRole: ReviewerRoleType.SCIENTIST,
    assignmentRole: ReviewerRoundRole.SCIENTIFIC,
  };
};

async function getActiveSlaContext(committeeId: number) {
  const [configs, holidayRows] = await Promise.all([
    prisma.configSLA.findMany({
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
    prisma.holiday.findMany({
      select: { date: true },
    }),
  ]);

  return {
    configMap: buildSlaConfigMap(configs),
    holidayDates: holidayRows.map((row) => row.date),
  };
}

const resolveStatusChangeSlaPatch = async (
  submission: {
    project: { committeeId: number } | null;
    classification: { reviewType: ReviewType; classificationDate: Date } | null;
  },
  newStatus: SubmissionStatus
) => {
  const committeeId = submission.project?.committeeId ?? null;
  if (!committeeId) {
    return newStatus === SubmissionStatus.CLASSIFIED
      ? { exemptNotificationDueDate: null as Date | null }
      : {};
  }

  const { configMap, holidayDates } = await getActiveSlaContext(committeeId);

  if (
    newStatus === SubmissionStatus.AWAITING_CLASSIFICATION ||
    newStatus === SubmissionStatus.UNDER_CLASSIFICATION
  ) {
    const classificationConfig = getConfiguredSlaOrDefault(
      configMap,
      committeeId,
      SLAStage.CLASSIFICATION,
      null
    );
    return {
      classificationDueDate: classificationConfig
        ? computeDueDate(
            classificationConfig.dayMode,
            new Date(),
            classificationConfig.targetDays,
            holidayDates
          )
        : null,
      exemptNotificationDueDate: null as Date | null,
    };
  }

  if (newStatus === SubmissionStatus.CLASSIFIED) {
    const exemptNotificationConfig =
      submission.classification?.reviewType === ReviewType.EXEMPT
        ? getConfiguredSlaOrDefault(
            configMap,
            committeeId,
            SLAStage.EXEMPT_NOTIFICATION,
            ReviewType.EXEMPT
          )
        : null;

    return {
      exemptNotificationDueDate:
        exemptNotificationConfig && submission.classification?.classificationDate
          ? computeDueDate(
              exemptNotificationConfig.dayMode,
              submission.classification.classificationDate,
              exemptNotificationConfig.targetDays,
              holidayDates
            )
          : null,
    };
  }

  return {};
};

const buildBulkResult = (
  submissionId: number,
  projectCode: string | null,
  status: BulkResultStatus,
  message: string,
  data?: Record<string, unknown> | null
): BulkActionResult => ({
  submissionId,
  projectCode,
  status,
  message,
  data: data ?? null,
});

const summarizeBulkResults = (
  requestedCount: number,
  results: BulkActionResult[]
): BulkActionResponse => ({
  requestedCount,
  succeeded: results.filter((item) => item.status === "SUCCEEDED").length,
  skipped: results.filter((item) => item.status === "SKIPPED").length,
  failed: results.filter((item) => item.status === "FAILED").length,
  results,
});

const getBulkResultStatusForError = (error: unknown): BulkResultStatus => {
  if (error instanceof AppError && SKIPPABLE_ERROR_CODES.has(error.code)) {
    return "SKIPPED";
  }
  return "FAILED";
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof AppError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error";
};

async function getBulkSubmissionContexts(submissionIds: number[]) {
  const softDeleteEnabled = await hasProjectSoftDeleteColumns();
  const submissions = await prisma.submission.findMany({
    where: { id: { in: submissionIds } },
    select: {
      id: true,
      status: true,
      project: {
        select: softDeleteEnabled
          ? {
              projectCode: true,
              deletedAt: true,
              purgedAt: true,
            }
          : {
              projectCode: true,
            },
      },
      classification: {
        select: {
          reviewType: true,
          panelId: true,
        },
      },
      reviews: {
        select: { id: true },
      },
    },
  });

  return new Map<number, BulkSubmissionContext>(
    submissions.map((submission) => [submission.id, submission])
  );
}

/* ------------------------------------------------------------------ */
/*  Classify                                                           */
/* ------------------------------------------------------------------ */
export async function classifySubmission(
  submissionId: number,
  data: {
    reviewType: ReviewType | null;
    classificationDate?: string;
    panelId?: number | null;
    rationale?: string;
  },
  classifiedById: number
) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      project: {
        select: {
          committeeId: true,
        },
      },
    },
  });
  if (!submission) throw new AppError(404, "NOT_FOUND", "Submission not found");

  const canClassifyAtStatus =
    submission.status === SubmissionStatus.AWAITING_CLASSIFICATION ||
    submission.status === SubmissionStatus.UNDER_CLASSIFICATION ||
    submission.status === SubmissionStatus.CLASSIFIED;
  if (!canClassifyAtStatus) {
    throw new AppError(
      400,
      "INVALID_WORKFLOW_STAGE",
      "Review type can only be set after classification starts."
    );
  }

  if (!data.reviewType) {
    await prisma.$transaction(async (tx) => {
      await tx.classification.deleteMany({ where: { submissionId } });
      const previousStatus = submission.status;
      const nextStatus =
        previousStatus === SubmissionStatus.CLASSIFIED
          ? SubmissionStatus.CLASSIFIED
          : SubmissionStatus.AWAITING_CLASSIFICATION;
      await tx.submission.update({
        where: { id: submissionId },
        data: {
          status: nextStatus,
          exemptNotificationDueDate: null,
        },
      });
      if (previousStatus !== nextStatus) {
        await tx.submissionStatusHistory.create({
          data: {
            submissionId,
            oldStatus: previousStatus,
            newStatus: nextStatus,
            reason: "Classification cleared",
            changedById: classifiedById,
          },
        });
      }
    });

    await logAuditEvent({
      actorId: classifiedById,
      action: "SUBMISSION_CLASSIFICATION_CLEARED",
      entityType: "Submission",
      entityId: submissionId,
      metadata: {},
    });

    return { submissionId, reviewType: null };
  }

  const reviewType = data.reviewType as ReviewType;
  const classificationDate = new Date(data.classificationDate ?? new Date().toISOString());
  if (Number.isNaN(classificationDate.getTime())) {
    throw new AppError(400, "INVALID_DATE", "Invalid classificationDate");
  }

  const committeeId = submission.project?.committeeId ?? null;

  // Validate panelId belongs to this submission's committee and is active
  if (data.panelId != null) {
    const panel = await prisma.panel.findUnique({
      where: { id: data.panelId },
      select: { id: true, committeeId: true, isActive: true },
    });
    if (!panel) {
      throw new AppError(400, "INVALID_PANEL", "Panel not found");
    }
    if (panel.committeeId !== committeeId) {
      throw new AppError(
        400,
        "INVALID_PANEL",
        "Panel does not belong to this submission's committee"
      );
    }
    if (!panel.isActive) {
      throw new AppError(400, "INVALID_PANEL", "Panel is inactive");
    }
  }

  const exemptNotificationDueDate =
    reviewType === ReviewType.EXEMPT && committeeId
      ? await (async () => {
          const { configMap, holidayDates } = await getActiveSlaContext(committeeId);
          const exemptConfig = getConfiguredSlaOrDefault(
            configMap,
            committeeId,
            SLAStage.EXEMPT_NOTIFICATION,
            ReviewType.EXEMPT
          );
          return exemptConfig
            ? computeDueDate(
                exemptConfig.dayMode,
                classificationDate,
                exemptConfig.targetDays,
                holidayDates
              )
            : null;
        })()
      : null;

  const result = await prisma.$transaction(async (tx) => {
    const classification = await tx.classification.upsert({
      where: { submissionId },
      update: {
        reviewType,
        classificationDate,
        panelId: data.panelId ?? null,
        rationale: data.rationale,
        classifiedById,
      },
      create: {
        submissionId,
        reviewType,
        classificationDate,
        panelId: data.panelId ?? null,
        rationale: data.rationale,
        classifiedById,
      },
    });

    const previousStatus = submission.status;
    if (previousStatus !== SubmissionStatus.CLASSIFIED) {
      await tx.submission.update({
        where: { id: submissionId },
        data: {
          status: SubmissionStatus.CLASSIFIED,
          exemptNotificationDueDate,
        },
      });
    } else {
      await tx.submission.update({
        where: { id: submissionId },
        data: {
          exemptNotificationDueDate,
        },
      });
    }
    await tx.submissionStatusHistory.create({
      data: {
        submissionId,
        oldStatus: previousStatus,
        newStatus: SubmissionStatus.CLASSIFIED,
        reason: `Classified as ${reviewType}`,
        changedById: classifiedById,
      },
    });
    return classification;
  });

  await logAuditEvent({
    actorId: classifiedById,
    action: "SUBMISSION_CLASSIFIED",
    entityType: "Submission",
    entityId: submissionId,
    metadata: { reviewType, panelId: data.panelId ?? null },
  });

  return result;
}

/* ------------------------------------------------------------------ */
/*  Get by ID                                                          */
/* ------------------------------------------------------------------ */
function isMissingOptionalRelationError(
  error: unknown
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

async function loadOptionalSubmissionRelations(submissionId: number) {
  const reviewAssignments = await prisma.reviewAssignment.findMany({
    where: { submissionId },
    include: { reviewer: true },
    orderBy: [{ roundSequence: "asc" }, { assignedAt: "asc" }],
  }).catch((error: unknown) => {
    if (isMissingOptionalRelationError(error)) {
      logger.warn(
        {
          submissionId,
          relation: "reviewAssignments",
          prismaCode: error.code,
          message: error.message,
        },
        "Optional submission detail relation unavailable; returning empty list"
      );
      return [];
    }
    throw error;
  });

  const reminderLogs = await prisma.submissionReminderLog.findMany({
    where: { submissionId },
    include: { actor: true },
    orderBy: { createdAt: "desc" },
  }).catch((error: unknown) => {
    if (isMissingOptionalRelationError(error)) {
      logger.warn(
        {
          submissionId,
          relation: "reminderLogs",
          prismaCode: error.code,
          message: error.message,
        },
        "Optional submission detail relation unavailable; returning empty list"
      );
      return [];
    }
    throw error;
  });

  const projectChangeLogs = await prisma.projectChangeLog.findMany({
    where: { sourceSubmissionId: submissionId },
    include: { changedBy: true },
    orderBy: { createdAt: "desc" },
  }).catch((error: unknown) => {
    if (isMissingOptionalRelationError(error)) {
      logger.warn(
        {
          submissionId,
          relation: "projectChangeLogs",
          prismaCode: error.code,
          message: error.message,
        },
        "Optional submission detail relation unavailable; returning empty list"
      );
      return [];
    }
    throw error;
  });

  return {
    reviewAssignments,
    reminderLogs,
    projectChangeLogs,
  };
}

export async function getSubmissionById(id: number) {
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      project: {
        select: submissionProjectDetailSelect,
      },
      classification: { include: { panel: true, classifiedBy: true } },
      reviews: { include: { reviewer: true }, orderBy: { assignedAt: "asc" } },
      documents: { orderBy: [{ type: "asc" }, { createdAt: "asc" }] },
      statusHistory: {
        include: { changedBy: true },
        orderBy: { effectiveDate: "asc" },
      },
      changeLogs: {
        include: { changedBy: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!submission) throw new AppError(404, "NOT_FOUND", "Submission not found");
  const optionalRelations = await loadOptionalSubmissionRelations(id);
  return {
    ...submission,
    ...optionalRelations,
  };
}

/* ------------------------------------------------------------------ */
/*  Update overview                                                    */
/* ------------------------------------------------------------------ */
export async function updateSubmissionOverview(
  id: number,
  body: Record<string, any>,
  changedById: number
) {
  const {
    submissionType, receivedDate, finalDecision,
    finalDecisionDate, piName, committeeId, changeReason,
  } = body;

  const allowedSubmissionTypes = [
    "INITIAL", "AMENDMENT", "CONTINUING_REVIEW", "FINAL_REPORT",
    "WITHDRAWAL", "SAFETY_REPORT", "PROTOCOL_DEVIATION",
  ];
  if (submissionType && !allowedSubmissionTypes.includes(String(submissionType))) {
    throw new AppError(400, "INVALID_SUBMISSION_TYPE",
      `Invalid submissionType. Allowed: ${allowedSubmissionTypes.join(", ")}`);
  }

  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      project: {
        select: submissionProjectOverviewSelect,
      },
    },
  });
  if (!submission) throw new AppError(404, "NOT_FOUND", "Submission not found");

  const submissionUpdate: Record<string, any> = {};
  const projectUpdate: Record<string, any> = {};
  const changeLogs: Array<{
    submissionId: number; fieldName: string;
    oldValue: string | null; newValue: string | null;
    reason?: string | null; changedById?: number;
  }> = [];
  const projectChangeLogs: Array<{
    projectId: number; fieldName: string;
    oldValue: string | null; newValue: string | null;
    reason?: string | null; sourceSubmissionId?: number; changedById?: number;
  }> = [];

  if (submissionType && submissionType !== submission.submissionType) {
    submissionUpdate.submissionType = submissionType;
    changeLogs.push({
      submissionId: submission.id, fieldName: "submissionType",
      oldValue: submission.submissionType, newValue: submissionType,
      reason: changeReason ?? null, changedById,
    });
  }

  if (receivedDate) {
    const parsedReceived = new Date(receivedDate);
    if (Number.isNaN(parsedReceived.getTime())) {
      throw new AppError(400, "INVALID_DATE", "Invalid receivedDate");
    }
    const oldValue = submission.receivedDate?.toISOString() ?? null;
    const newValue = parsedReceived.toISOString();
    if (oldValue !== newValue) {
      submissionUpdate.receivedDate = parsedReceived;
      changeLogs.push({
        submissionId: submission.id, fieldName: "receivedDate",
        oldValue, newValue, reason: changeReason ?? null, changedById,
      });
    }
  }

  if (finalDecision !== undefined && finalDecision !== submission.finalDecision) {
    submissionUpdate.finalDecision = finalDecision;
    changeLogs.push({
      submissionId: submission.id, fieldName: "finalDecision",
      oldValue: submission.finalDecision ?? null,
      newValue: finalDecision ?? null,
      reason: changeReason ?? null, changedById,
    });
  }

  if (finalDecisionDate !== undefined) {
    const parsedDecisionDate = finalDecisionDate === null ? null : new Date(finalDecisionDate);
    if (finalDecisionDate !== null && Number.isNaN(parsedDecisionDate?.getTime())) {
      throw new AppError(400, "INVALID_DATE", "Invalid finalDecisionDate");
    }
    const oldValue = submission.finalDecisionDate
      ? submission.finalDecisionDate.toISOString() : null;
    const newValue = parsedDecisionDate ? parsedDecisionDate.toISOString() : null;
    if (oldValue !== newValue) {
      submissionUpdate.finalDecisionDate = parsedDecisionDate;
      changeLogs.push({
        submissionId: submission.id, fieldName: "finalDecisionDate",
        oldValue, newValue, reason: changeReason ?? null, changedById,
      });
    }
  }

  if (submission.project) {
    if (piName && piName !== submission.project.piName) {
      projectUpdate.piName = piName;
      projectChangeLogs.push({
        projectId: submission.project.id, fieldName: "piName",
        oldValue: submission.project.piName, newValue: piName,
        reason: changeReason ?? null, sourceSubmissionId: submission.id, changedById,
      });
    }
    if (committeeId) {
      const parsedCommitteeId = Number(committeeId);
      if (Number.isNaN(parsedCommitteeId)) {
        throw new AppError(400, "INVALID_INPUT", "Invalid committeeId");
      }
      const committeeExists = await prisma.committee.findUnique({
        where: { id: parsedCommitteeId }, select: { id: true },
      });
      if (!committeeExists) {
        throw new AppError(400, "INVALID_INPUT", "committeeId does not exist");
      }
      if (parsedCommitteeId !== submission.project.committeeId) {
        projectUpdate.committeeId = parsedCommitteeId;
        projectChangeLogs.push({
          projectId: submission.project.id, fieldName: "committeeId",
          oldValue: submission.project.committeeId
            ? String(submission.project.committeeId) : null,
          newValue: String(parsedCommitteeId),
          reason: changeReason ?? null, sourceSubmissionId: submission.id, changedById,
        });
      }
    }
  } else if (piName || committeeId) {
    throw new AppError(400, "INVALID_INPUT", "Submission is not linked to a project");
  }

  const hasUpdates =
    Object.keys(submissionUpdate).length > 0 ||
    Object.keys(projectUpdate).length > 0 ||
    changeLogs.length > 0 || projectChangeLogs.length > 0;
  if (!hasUpdates) {
    throw new AppError(400, "NO_CHANGES", "No changes to update");
  }

  const operations: any[] = [];
  if (Object.keys(submissionUpdate).length > 0) {
    operations.push(prisma.submission.update({ where: { id: submission.id }, data: submissionUpdate }));
  }
  if (Object.keys(projectUpdate).length > 0 && submission.project) {
    operations.push(prisma.project.update({ where: { id: submission.project.id }, data: projectUpdate }));
  }
  if (changeLogs.length > 0) {
    operations.push(prisma.submissionChangeLog.createMany({ data: changeLogs }));
  }
  if (projectChangeLogs.length > 0) {
    operations.push(prisma.projectChangeLog.createMany({ data: projectChangeLogs }));
  }

  await prisma.$transaction(operations);

  return getSubmissionById(submission.id);
}

/* ------------------------------------------------------------------ */
/*  Screening actions                                                  */
/* ------------------------------------------------------------------ */
export async function startSubmissionCompletenessCheck(
  submissionId: number,
  data: {
    completenessStatus?: "COMPLETE" | "MINOR_MISSING" | "MAJOR_MISSING" | "MISSING_SIGNATURES" | "OTHER";
    completenessRemarks?: string | null;
  },
  changedById: number
) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, status: true },
  });
  if (!submission) throw new AppError(404, "NOT_FOUND", "Submission not found");
  if (
    submission.status !== SubmissionStatus.RECEIVED &&
    submission.status !== SubmissionStatus.RETURNED_FOR_COMPLETION
  ) {
    throw new AppError(
      400,
      "INVALID_WORKFLOW_STAGE",
      "Only RECEIVED or RETURNED_FOR_COMPLETION submissions can start completeness screening"
    );
  }

  const [history, updated] = await prisma.$transaction([
    prisma.submissionStatusHistory.create({
      data: {
        submissionId,
        oldStatus: submission.status,
        newStatus: SubmissionStatus.UNDER_COMPLETENESS_CHECK,
        reason: trimReason(data.completenessRemarks) ?? "Completeness screening started",
        changedById,
      },
    }),
    prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: SubmissionStatus.UNDER_COMPLETENESS_CHECK,
        completenessStatus: data.completenessStatus,
        completenessRemarks: trimReason(data.completenessRemarks),
      },
    }),
  ]);

  return { submission: updated, history };
}

export async function returnSubmissionForCompletion(
  submissionId: number,
  data: {
    reason: string;
    completenessStatus?: "COMPLETE" | "MINOR_MISSING" | "MAJOR_MISSING" | "MISSING_SIGNATURES" | "OTHER";
    completenessRemarks?: string | null;
  },
  changedById: number
) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, status: true },
  });
  if (!submission) throw new AppError(404, "NOT_FOUND", "Submission not found");
  if (
    submission.status !== SubmissionStatus.RECEIVED &&
    submission.status !== SubmissionStatus.UNDER_COMPLETENESS_CHECK
  ) {
    throw new AppError(
      400,
      "INVALID_WORKFLOW_STAGE",
      "Only submissions in intake screening can be returned for completion"
    );
  }

  const reason = requireReason(trimReason(data.reason), "Returning a submission for completion");
  const [history, updated] = await prisma.$transaction([
    prisma.submissionStatusHistory.create({
      data: {
        submissionId,
        oldStatus: submission.status,
        newStatus: SubmissionStatus.RETURNED_FOR_COMPLETION,
        reason,
        changedById,
      },
    }),
    prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: SubmissionStatus.RETURNED_FOR_COMPLETION,
        completenessStatus: data.completenessStatus ?? undefined,
        completenessRemarks: trimReason(data.completenessRemarks) ?? reason,
      },
    }),
  ]);

  return { submission: updated, history };
}

export async function markSubmissionNotAccepted(
  submissionId: number,
  data: {
    reason: string;
    completenessStatus?: "COMPLETE" | "MINOR_MISSING" | "MAJOR_MISSING" | "MISSING_SIGNATURES" | "OTHER";
    completenessRemarks?: string | null;
  },
  changedById: number
) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, status: true },
  });
  if (!submission) throw new AppError(404, "NOT_FOUND", "Submission not found");
  if (
    submission.status !== SubmissionStatus.RECEIVED &&
    submission.status !== SubmissionStatus.UNDER_COMPLETENESS_CHECK
  ) {
    throw new AppError(
      400,
      "INVALID_WORKFLOW_STAGE",
      "Only submissions in intake screening can be marked not accepted"
    );
  }

  const reason = requireReason(trimReason(data.reason), "Marking a submission as not accepted");
  const [history, updated] = await prisma.$transaction([
    prisma.submissionStatusHistory.create({
      data: {
        submissionId,
        oldStatus: submission.status,
        newStatus: SubmissionStatus.NOT_ACCEPTED,
        reason,
        changedById,
      },
    }),
    prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: SubmissionStatus.NOT_ACCEPTED,
        completenessStatus: data.completenessStatus ?? undefined,
        completenessRemarks: trimReason(data.completenessRemarks) ?? reason,
      },
    }),
  ]);

  return { submission: updated, history };
}

export async function acceptSubmissionForClassification(
  submissionId: number,
  data: {
    projectCode?: string;
    reason?: string | null;
    completenessRemarks?: string | null;
  },
  changedById: number
) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      project: {
        select: {
          id: true,
          projectCode: true,
          committeeId: true,
        },
      },
    },
  });
  if (!submission || !submission.project) {
    throw new AppError(404, "NOT_FOUND", "Submission not found");
  }
  if (
    submission.status !== SubmissionStatus.RECEIVED &&
    submission.status !== SubmissionStatus.UNDER_COMPLETENESS_CHECK &&
    submission.status !== SubmissionStatus.RETURNED_FOR_COMPLETION
  ) {
    throw new AppError(
      400,
      "INVALID_WORKFLOW_STAGE",
      "Only submissions in intake screening can be accepted for classification"
    );
  }

  const normalizedProjectCode = data.projectCode?.trim().toUpperCase() || submission.project.projectCode || null;
  if (!normalizedProjectCode) {
    throw new AppError(400, "PROJECT_CODE_REQUIRED", "projectCode is required before classification");
  }

  const updatedReason =
    trimReason(data.reason) ?? `Accepted for classification with project code ${normalizedProjectCode}`;

  const { configMap, holidayDates } = await getActiveSlaContext(submission.project.committeeId);
  const classificationConfig = getConfiguredSlaOrDefault(
    configMap,
    submission.project.committeeId,
    SLAStage.CLASSIFICATION,
    null
  );
  const classificationDueDate = classificationConfig
    ? computeDueDate(classificationConfig.dayMode, new Date(), classificationConfig.targetDays, holidayDates)
    : null;

  const result = await prisma.$transaction(async (tx) => {
    const duplicateProject = await tx.project.findFirst({
      where: {
        projectCode: normalizedProjectCode,
        NOT: { id: submission.project!.id },
      },
      select: { id: true },
    });
    if (duplicateProject) {
      throw new AppError(409, "DUPLICATE_PROJECT_CODE", "Project code already exists");
    }

    await tx.project.update({
      where: { id: submission.project!.id },
      data: { projectCode: normalizedProjectCode },
    });

    const history = await tx.submissionStatusHistory.create({
      data: {
        submissionId,
        oldStatus: submission.status,
        newStatus: SubmissionStatus.AWAITING_CLASSIFICATION,
        reason: updatedReason,
        changedById,
      },
    });

    const updatedSubmission = await tx.submission.update({
      where: { id: submissionId },
      data: {
        status: SubmissionStatus.AWAITING_CLASSIFICATION,
        completenessStatus: "COMPLETE",
        completenessRemarks: trimReason(data.completenessRemarks) ?? null,
        classificationDueDate,
      },
    });

    return { submission: updatedSubmission, history };
  });

  return result;
}

export async function resubmitSubmission(
  submissionId: number,
  data: {
    receivedDate?: string | null;
    documentLink?: string | null;
    remarks?: string | null;
  },
  changedById: number
) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      status: true,
      remarks: true,
      documentLink: true,
      revisionDueDate: true,
    },
  });
  if (!submission) throw new AppError(404, "NOT_FOUND", "Submission not found");
  if (
    submission.status !== SubmissionStatus.RETURNED_FOR_COMPLETION &&
    submission.status !== SubmissionStatus.AWAITING_REVISIONS
  ) {
    throw new AppError(
      400,
      "INVALID_WORKFLOW_STAGE",
      "Only returned or revision-requested submissions can be resubmitted"
    );
  }

  const receivedDate = data.receivedDate ? new Date(data.receivedDate) : new Date();
  if (Number.isNaN(receivedDate.getTime())) {
    throw new AppError(400, "INVALID_DATE", "Invalid receivedDate");
  }

  const nextStatus =
    submission.status === SubmissionStatus.RETURNED_FOR_COMPLETION
      ? SubmissionStatus.RECEIVED
      : SubmissionStatus.REVISION_SUBMITTED;
  const reason =
    nextStatus === SubmissionStatus.RECEIVED
      ? "Submission resubmitted after completeness return"
      : "Revision submission received from proponent";

  const [history, updated] = await prisma.$transaction([
    prisma.submissionStatusHistory.create({
      data: {
        submissionId,
        oldStatus: submission.status,
        newStatus: nextStatus,
        reason,
        changedById,
      },
    }),
    prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: nextStatus,
        receivedDate,
        documentLink:
          data.documentLink === undefined
            ? submission.documentLink
            : data.documentLink?.trim() || null,
        remarks: trimReason(data.remarks) ?? submission.remarks,
        completenessRemarks:
          nextStatus === SubmissionStatus.RECEIVED
            ? trimReason(data.remarks)
            : undefined,
        classificationDueDate:
          nextStatus === SubmissionStatus.RECEIVED
            ? null
            : undefined,
        exemptNotificationDueDate:
          nextStatus === SubmissionStatus.RECEIVED
            ? null
            : undefined,
        revisionDueDate:
          nextStatus === SubmissionStatus.REVISION_SUBMITTED
            ? submission.revisionDueDate
            : null,
      },
    }),
  ]);

  return { submission: updated, history };
}

export async function addSubmissionDocument(
  submissionId: number,
  data: {
    type: SubmissionDocumentType;
    title: string;
    documentUrl?: string | null;
    notes?: string | null;
  },
  actorId: number
) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true },
  });
  if (!submission) throw new AppError(404, "NOT_FOUND", "Submission not found");

  const document = await prisma.submissionDocument.create({
    data: {
      submissionId,
      type: data.type,
      title: data.title.trim(),
      documentUrl: data.documentUrl?.trim() || null,
      notes: trimReason(data.notes),
      status: data.documentUrl ? SubmissionDocumentStatus.RECEIVED : SubmissionDocumentStatus.PENDING,
      receivedAt: data.documentUrl ? new Date() : null,
    },
  });

  await logAuditEvent({
    actorId,
    action: "SUBMISSION_DOCUMENT_ADDED",
    entityType: "Submission",
    entityId: submissionId,
    metadata: { documentId: document.id, type: document.type },
  });

  return document;
}

export async function removeSubmissionDocument(
  submissionId: number,
  documentId: number,
  actorId: number
) {
  const document = await prisma.submissionDocument.findUnique({
    where: { id: documentId },
    select: { id: true, submissionId: true },
  });
  if (!document || document.submissionId !== submissionId) {
    throw new AppError(404, "NOT_FOUND", "Submission document not found");
  }

  await prisma.submissionDocument.delete({ where: { id: documentId } });

  await logAuditEvent({
    actorId,
    action: "SUBMISSION_DOCUMENT_REMOVED",
    entityType: "Submission",
    entityId: submissionId,
    metadata: { documentId },
  });

  return { success: true };
}

/* ------------------------------------------------------------------ */
/*  Change status                                                      */
/* ------------------------------------------------------------------ */
export async function updateSubmissionStatus(
  id: number,
  newStatus: SubmissionStatus,
  reason: string | undefined,
  changedById: number
) {
  const submission = await prisma.submission.findUnique({
    where: { id },
    select: {
      status: true,
      project: {
        select: {
          committeeId: true,
        },
      },
      classification: {
        select: {
          reviewType: true,
          classificationDate: true,
        },
      },
    },
  });
  if (!submission) throw new AppError(404, "NOT_FOUND", "Submission not found");
  const currentIndex = WORKFLOW_STAGE_ORDER.indexOf(submission.status);
  const nextIndex = WORKFLOW_STAGE_ORDER.indexOf(newStatus);
  if (currentIndex === -1 || nextIndex === -1) {
    throw new AppError(400, "INVALID_WORKFLOW_STAGE", "Unsupported workflow stage transition.");
  }
  if (currentIndex === nextIndex) {
    throw new AppError(400, "NO_CHANGES", "Submission is already in that workflow stage.");
  }
  if (nextIndex < currentIndex) {
    throw new AppError(400, "INVALID_TRANSITION", "Workflow stage can only move forward.");
  }

  const slaPatch = await resolveStatusChangeSlaPatch(submission, newStatus);

  const [history, updated] = await prisma.$transaction([
    prisma.submissionStatusHistory.create({
      data: { submissionId: id, oldStatus: submission.status, newStatus, reason, changedById },
    }),
    prisma.submission.update({ where: { id }, data: { status: newStatus, ...slaPatch } }),
  ]);
  return { submission: updated, history };
}

/* ------------------------------------------------------------------ */
/*  Assign reviewer                                                    */
/* ------------------------------------------------------------------ */
export async function assignReviewer(
  submissionId: number,
  reviewerId: number,
  isPrimary: boolean,
  reviewerRoleInput: string | null | undefined,
  dueDateInput: string | null | undefined,
  actorId: number
) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      classification: true,
      project: {
        select: {
          committeeId: true,
        },
      },
    },
  });
  if (!submission) throw new AppError(404, "NOT_FOUND", "Submission not found");
  if (!submission.classification) {
    throw new AppError(400, "NOT_CLASSIFIED", "Submission must be classified before assigning reviewers");
  }
  if (submission.classification.reviewType === ReviewType.EXEMPT) {
    throw new AppError(400, "INVALID_REVIEW_SETUP", "EXEMPT submissions do not require reviewer assignment");
  }

  const reviewer = await prisma.user.findUnique({ where: { id: reviewerId } });
  if (!reviewer) throw new AppError(404, "NOT_FOUND", "Reviewer not found");
  if (!reviewer.isActive || reviewer.status !== UserStatus.APPROVED) {
    throw new AppError(400, "INVALID_REVIEWER", "Reviewer must be active and approved");
  }

  const { reviewRole, assignmentRole } = normalizeReviewerRoles(reviewerRoleInput);
  const explicitDueDate = dueDateInput ? new Date(dueDateInput) : null;
  if (explicitDueDate && Number.isNaN(explicitDueDate.getTime())) {
    throw new AppError(400, "INVALID_DATE", "Invalid dueDate");
  }

  const { configMap, holidayDates } = await getActiveSlaContext(submission.project?.committeeId ?? 0);
  const reviewConfig = getConfiguredSlaOrDefault(
    configMap,
    submission.project?.committeeId ?? null,
    SLAStage.REVIEW,
    submission.classification.reviewType
  );
  const dueDate =
    explicitDueDate ??
    (reviewConfig
      ? computeDueDate(
          reviewConfig.dayMode,
          new Date(),
          reviewConfig.targetDays,
          holidayDates
        )
      : null);

  let review;
  try {
    review = await prisma.$transaction(async (tx) => {
      const createdReview = await tx.review.create({
        data: {
          submissionId,
          reviewerId,
          isPrimary,
          reviewerRole: reviewRole,
          dueDate,
        },
      });

      if (assignmentRole) {
        const existingAssignment = await tx.reviewAssignment.findFirst({
          where: {
            submissionId,
            roundSequence: submission.sequenceNumber,
            reviewerRole: assignmentRole,
            isActive: true,
          },
        });

        if (!existingAssignment || existingAssignment.reviewerId === reviewerId) {
          await tx.reviewAssignment.upsert({
            where: {
              submissionId_roundSequence_reviewerRole: {
                submissionId,
                roundSequence: submission.sequenceNumber,
                reviewerRole: assignmentRole,
              },
            },
            update: {
              reviewerId,
              dueDate,
              isActive: true,
              endedAt: null,
              submittedAt: null,
            },
            create: {
              submissionId,
              roundSequence: submission.sequenceNumber,
              reviewerId,
              reviewerRole: assignmentRole,
              dueDate,
            },
          });
        }
      }

      return createdReview;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        409,
        "DUPLICATE_REVIEWER_ASSIGNMENT",
        "Reviewer is already assigned to this submission"
      );
    }
    throw error;
  }
  await logAuditEvent({
    actorId,
    action: "REVIEWER_ASSIGNED",
    entityType: "Submission",
    entityId: submissionId,
    metadata: { reviewerId, isPrimary, reviewerRole: reviewRole, dueDate: dueDate?.toISOString() ?? null },
  });
  return review;
}

/* ------------------------------------------------------------------ */
/*  Start review                                                      */
/* ------------------------------------------------------------------ */
export async function startSubmissionReview(submissionId: number, actorId: number) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      classification: true,
      reviews: true,
    },
  });
  if (!submission) throw new AppError(404, "NOT_FOUND", "Submission not found");
  if (!submission.classification) {
    throw new AppError(400, "NOT_CLASSIFIED", "Submission must be classified before starting review");
  }

  const reviewType = submission.classification.reviewType;
  if (reviewType === ReviewType.EXEMPT) {
    throw new AppError(400, "INVALID_REVIEW_SETUP", "EXEMPT submissions cannot be moved to UNDER_REVIEW");
  }
  if (reviewType === ReviewType.FULL_BOARD && !submission.classification.panelId) {
    throw new AppError(400, "PANEL_REQUIRED", "FULL_BOARD requires an assigned panel before starting review");
  }
  if ((submission.reviews ?? []).length < 1) {
    throw new AppError(400, "REVIEWER_REQUIRED", "Assign at least one reviewer before starting review");
  }
  if (submission.status === SubmissionStatus.UNDER_REVIEW) {
    throw new AppError(400, "NO_CHANGES", "Submission is already under review");
  }
  if (
    submission.status !== SubmissionStatus.CLASSIFIED &&
    submission.status !== SubmissionStatus.REVISION_SUBMITTED
  ) {
    throw new AppError(
      400,
      "INVALID_WORKFLOW_STAGE",
      "Only CLASSIFIED or REVISION_SUBMITTED submissions can start review"
    );
  }

  const [history, updated] = await prisma.$transaction([
    prisma.submissionStatusHistory.create({
      data: {
        submissionId,
        oldStatus: submission.status,
        newStatus: SubmissionStatus.UNDER_REVIEW,
        reason: "Review started",
        changedById: actorId,
      },
    }),
    prisma.submission.update({
      where: { id: submissionId },
      data: { status: SubmissionStatus.UNDER_REVIEW },
    }),
  ]);

  await logAuditEvent({
    actorId,
    action: "SUBMISSION_REVIEW_STARTED",
    entityType: "Submission",
    entityId: submissionId,
    metadata: { reviewType },
  });

  return { submission: updated, history };
}

/* ------------------------------------------------------------------ */
/*  Dashboard bulk actions                                             */
/* ------------------------------------------------------------------ */
export async function listReviewerCandidates() {
  return prisma.user.findMany({
    where: {
      isActive: true,
      status: UserStatus.APPROVED,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      roles: true,
      isCommonReviewer: true,
      reviewerExpertise: true,
    },
    orderBy: [{ fullName: "asc" }],
  });
}

export async function bulkAssignReviewerToSubmissions(
  submissionIds: number[],
  data: {
    reviewerId: number;
    reviewerRole: "SCIENTIST" | "LAY" | "INDEPENDENT_CONSULTANT";
    dueDate?: string | null;
    isPrimary?: boolean;
  },
  actorId: number
) {
  const contexts = await getBulkSubmissionContexts(submissionIds);
  const results: BulkActionResult[] = [];

  for (const submissionId of submissionIds) {
    const context = contexts.get(submissionId);
    const projectCode = context?.project?.projectCode ?? null;

    if (!context) {
      results.push(
        buildBulkResult(
          submissionId,
          null,
          "FAILED",
          "Submission not found"
        )
      );
      continue;
    }

    try {
      assertProjectIsMutable(context.project);

      const review = await assignReviewer(
        submissionId,
        data.reviewerId,
        Boolean(data.isPrimary),
        data.reviewerRole,
        data.dueDate,
        actorId
      );

      results.push(
        buildBulkResult(
          submissionId,
          projectCode,
          "SUCCEEDED",
          "Reviewer assigned",
          { reviewId: review.id, reviewerId: data.reviewerId }
        )
      );
    } catch (error) {
      results.push(
        buildBulkResult(
          submissionId,
          projectCode,
          getBulkResultStatusForError(error),
          getErrorMessage(error)
        )
      );
    }
  }

  return summarizeBulkResults(submissionIds.length, results);
}

const requireBulkStatusActionPreconditions = (
  context: BulkSubmissionContext,
  action: BulkStatusAction,
  reason: string | null
) => {
  assertProjectIsMutable(context.project);

  if (action === "RETURN_FOR_COMPLETION") {
    requireReason(reason, "Returning a submission for completion");
    return;
  }

  if (action === "MARK_NOT_ACCEPTED") {
    requireReason(reason, "Marking a submission as not accepted");
    return;
  }

  if (action === "MARK_CLASSIFIED" && !context.classification?.reviewType) {
    throw new AppError(
      400,
      "CLASSIFICATION_REQUIRED",
      "Set a review type before marking the submission as classified"
    );
  }

  if (action !== "START_REVIEW") {
    return;
  }

  if (!context.classification) {
    throw new AppError(
      400,
      "NOT_CLASSIFIED",
      "Submission must be classified before starting review"
    );
  }

  if (context.classification.reviewType === ReviewType.EXEMPT) {
    throw new AppError(
      400,
      "INVALID_REVIEW_SETUP",
      "EXEMPT submissions cannot be moved to UNDER_REVIEW"
    );
  }

  if (
    context.classification.reviewType === ReviewType.FULL_BOARD &&
    !context.classification.panelId
  ) {
    throw new AppError(
      400,
      "PANEL_REQUIRED",
      "FULL_BOARD requires an assigned panel before starting review"
    );
  }

  if ((context.reviews ?? []).length < 1) {
    throw new AppError(
      400,
      "REVIEWER_REQUIRED",
      "Assign at least one reviewer before starting review"
    );
  }
};

export async function bulkRunSubmissionStatusAction(
  submissionIds: number[],
  data: {
    action: BulkStatusAction;
    reason?: string | null;
    completenessStatus?:
      | "COMPLETE"
      | "MINOR_MISSING"
      | "MAJOR_MISSING"
      | "MISSING_SIGNATURES"
      | "OTHER";
    completenessRemarks?: string | null;
  },
  actorId: number
) {
  const contexts = await getBulkSubmissionContexts(submissionIds);
  const results: BulkActionResult[] = [];
  const reason = trimReason(data.reason);
  const completenessRemarks = trimReason(data.completenessRemarks);

  for (const submissionId of submissionIds) {
    const context = contexts.get(submissionId);
    const projectCode = context?.project?.projectCode ?? null;

    if (!context) {
      results.push(
        buildBulkResult(
          submissionId,
          null,
          "FAILED",
          "Submission not found"
        )
      );
      continue;
    }

    try {
      requireBulkStatusActionPreconditions(context, data.action, reason);

      let result:
        | Awaited<ReturnType<typeof startSubmissionCompletenessCheck>>
        | Awaited<ReturnType<typeof returnSubmissionForCompletion>>
        | Awaited<ReturnType<typeof markSubmissionNotAccepted>>
        | Awaited<ReturnType<typeof acceptSubmissionForClassification>>
        | Awaited<ReturnType<typeof updateSubmissionStatus>>
        | Awaited<ReturnType<typeof startSubmissionReview>>;

      switch (data.action) {
        case "START_COMPLETENESS_CHECK":
          result = await startSubmissionCompletenessCheck(
            submissionId,
            {
              completenessStatus: data.completenessStatus,
              completenessRemarks: completenessRemarks ?? reason,
            },
            actorId
          );
          break;
        case "RETURN_FOR_COMPLETION":
          result = await returnSubmissionForCompletion(
            submissionId,
            {
              reason: requireReason(
                reason,
                "Returning a submission for completion"
              ),
              completenessStatus: data.completenessStatus,
              completenessRemarks,
            },
            actorId
          );
          break;
        case "MARK_NOT_ACCEPTED":
          result = await markSubmissionNotAccepted(
            submissionId,
            {
              reason: requireReason(
                reason,
                "Marking a submission as not accepted"
              ),
              completenessStatus: data.completenessStatus,
              completenessRemarks,
            },
            actorId
          );
          break;
        case "ACCEPT_FOR_CLASSIFICATION":
          result = await acceptSubmissionForClassification(
            submissionId,
            {
              reason,
              completenessRemarks,
            },
            actorId
          );
          break;
        case "MOVE_TO_UNDER_CLASSIFICATION":
          result = await updateSubmissionStatus(
            submissionId,
            SubmissionStatus.UNDER_CLASSIFICATION,
            reason ?? undefined,
            actorId
          );
          break;
        case "MARK_CLASSIFIED":
          result = await updateSubmissionStatus(
            submissionId,
            SubmissionStatus.CLASSIFIED,
            reason ?? undefined,
            actorId
          );
          break;
        case "START_REVIEW":
          result = await startSubmissionReview(submissionId, actorId);
          break;
        default:
          throw new AppError(400, "INVALID_ACTION", "Unsupported bulk status action");
      }

      results.push(
        buildBulkResult(
          submissionId,
          projectCode,
          "SUCCEEDED",
          "Action completed",
          {
            action: data.action,
            nextStatus: result.submission.status,
          }
        )
      );
    } catch (error) {
      results.push(
        buildBulkResult(
          submissionId,
          projectCode,
          getBulkResultStatusForError(error),
          getErrorMessage(error)
        )
      );
    }
  }

  return summarizeBulkResults(submissionIds.length, results);
}

export async function bulkCreateSubmissionReminders(
  submissionIds: number[],
  data: {
    target: ReminderTarget;
    note: string;
  },
  actorId: number
) {
  const contexts = await getBulkSubmissionContexts(submissionIds);
  const results: BulkActionResult[] = [];
  const note = data.note.trim();

  for (const submissionId of submissionIds) {
    const context = contexts.get(submissionId);
    const projectCode = context?.project?.projectCode ?? null;

    if (!context) {
      results.push(
        buildBulkResult(
          submissionId,
          null,
          "FAILED",
          "Submission not found"
        )
      );
      continue;
    }

    try {
      assertProjectIsMutable(context.project);

      const reminder = await prisma.submissionReminderLog.create({
        data: {
          submissionId,
          target: data.target,
          note,
          actorId,
        },
      });

      await logAuditEvent({
        actorId,
        action: "SUBMISSION_REMINDER_LOGGED",
        entityType: "Submission",
        entityId: submissionId,
        metadata: {
          target: data.target,
          reminderLogId: reminder.id,
        },
      });

      results.push(
        buildBulkResult(
          submissionId,
          projectCode,
          "SUCCEEDED",
          "Reminder logged",
          { reminderLogId: reminder.id, target: data.target }
        )
      );
    } catch (error) {
      results.push(
        buildBulkResult(
          submissionId,
          projectCode,
          getBulkResultStatusForError(error),
          getErrorMessage(error)
        )
      );
    }
  }

  return summarizeBulkResults(submissionIds.length, results);
}

/* ------------------------------------------------------------------ */
/*  Record review decision                                             */
/* ------------------------------------------------------------------ */
export async function recordReviewDecision(
  reviewId: number,
  decision: ReviewDecision,
  actorId: number,
  remarks?: string
) {
  const softDeleteEnabled = await hasProjectSoftDeleteColumns();
  const existing = await prisma.review.findUnique({
    where: { id: reviewId },
    ...(softDeleteEnabled
      ? {
          include: {
            submission: {
              select: {
                project: {
                  select: {
                    deletedAt: true,
                    purgedAt: true,
                  },
                },
              },
            },
          },
        }
      : {}),
  });
  if (!existing) throw new AppError(404, "NOT_FOUND", "Review not found");
  if (softDeleteEnabled) {
    assertProjectIsMutable((existing as typeof existing & { submission?: { project?: { deletedAt?: Date | null; purgedAt?: Date | null } | null } | null }).submission?.project ?? null);
  }

  const respondedAt = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const review = await tx.review.update({
      where: { id: reviewId },
      data: { decision, remarks, respondedAt },
    });

    const assignment = await tx.reviewAssignment.findFirst({
      where: {
        submissionId: existing.submissionId,
        reviewerId: existing.reviewerId,
        isActive: true,
      },
      orderBy: [{ roundSequence: "desc" }, { assignedAt: "desc" }],
    });

    if (assignment) {
      await tx.reviewAssignment.update({
        where: { id: assignment.id },
        data: {
          decision,
          remarks,
          submittedAt: respondedAt,
          isActive: false,
          endedAt: respondedAt,
        },
      });
    }

    return review;
  });
  await logAuditEvent({
    actorId,
    action: "REVIEW_DECISION_SUBMITTED",
    entityType: "Review",
    entityId: reviewId,
    metadata: { decision },
  });
  return updated;
}

/* ------------------------------------------------------------------ */
/*  Final decision                                                     */
/* ------------------------------------------------------------------ */
export async function recordFinalDecision(
  submissionId: number,
  data: {
    finalDecision: string;
    finalDecisionDate?: string;
    approvalStartDate?: string;
    approvalEndDate?: string;
    resultsNotifiedAt?: string;
    notes?: string;
  },
  actorId: number
) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      project: {
        select: {
          id: true,
          committeeId: true,
          overallStatus: true,
          approvalStartDate: true,
          approvalEndDate: true,
        },
      },
      classification: {
        select: {
          reviewType: true,
        },
      },
    },
  });
  if (!submission || !submission.project) {
    throw new AppError(404, "NOT_FOUND", "Submission not found");
  }
  if (submission.classification?.reviewType === ReviewType.EXEMPT) {
    throw new AppError(400, "INVALID_REVIEW_TYPE", "Use the exemption issue flow for EXEMPT submissions");
  }
  if (submission.status !== SubmissionStatus.UNDER_REVIEW) {
    throw new AppError(
      400,
      "INVALID_WORKFLOW_STAGE",
      "Only UNDER_REVIEW submissions can record a final decision"
    );
  }

  const notes = requireReason(trimReason(data.notes), "Recording a final decision");
  const decisionDate = data.finalDecisionDate ? new Date(data.finalDecisionDate) : new Date();
  if (Number.isNaN(decisionDate.getTime())) {
    throw new AppError(400, "INVALID_DATE", "Invalid finalDecisionDate");
  }

  const approvalStart = data.approvalStartDate ? new Date(data.approvalStartDate) : null;
  if (approvalStart && Number.isNaN(approvalStart.getTime())) {
    throw new AppError(400, "INVALID_DATE", "Invalid approvalStartDate");
  }

  const approvalEnd = data.approvalEndDate ? new Date(data.approvalEndDate) : null;
  if (approvalEnd && Number.isNaN(approvalEnd.getTime())) {
    throw new AppError(400, "INVALID_DATE", "Invalid approvalEndDate");
  }

  const resultsNotifiedAt = data.resultsNotifiedAt ? new Date(data.resultsNotifiedAt) : decisionDate;
  if (Number.isNaN(resultsNotifiedAt.getTime())) {
    throw new AppError(400, "INVALID_DATE", "Invalid resultsNotifiedAt");
  }

  const finalDecision = data.finalDecision;
  const isReviewDecision = Object.values(ReviewDecision).includes(finalDecision as ReviewDecision);
  if (!isReviewDecision && finalDecision !== "WITHDRAWN") {
    throw new AppError(400, "INVALID_DECISION", "Invalid finalDecision");
  }

  let nextStatus: SubmissionStatus = SubmissionStatus.CLOSED;
  let projectStatus: ProjectStatus | null = null;
  let revisionDueDate: Date | null = null;
  let decisionRecord: ReviewDecision | null = isReviewDecision
    ? (finalDecision as ReviewDecision)
    : null;

  if (finalDecision === ReviewDecision.MINOR_REVISIONS || finalDecision === ReviewDecision.MAJOR_REVISIONS) {
    const { configMap, holidayDates } = await getActiveSlaContext(submission.project.committeeId);
    const revisionSlaConfig = getConfiguredSlaOrDefault(
      configMap,
      submission.project.committeeId,
      SLAStage.REVISION_RESPONSE,
      null
    );
    nextStatus = SubmissionStatus.AWAITING_REVISIONS;
    revisionDueDate = revisionSlaConfig
      ? computeDueDate(
          revisionSlaConfig.dayMode,
          resultsNotifiedAt,
          revisionSlaConfig.targetDays,
          holidayDates
        )
      : null;
  } else if (finalDecision === ReviewDecision.DISAPPROVED) {
    projectStatus = ProjectStatus.INACTIVE;
  } else if (finalDecision === "WITHDRAWN") {
    nextStatus = SubmissionStatus.WITHDRAWN;
    decisionRecord = null;
  } else {
    projectStatus = ProjectStatus.ACTIVE;
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (decisionRecord) {
      await tx.submissionDecision.upsert({
        where: { submissionId },
        update: {
          decision: decisionRecord,
          decidedAt: decisionDate,
          validFrom: approvalStart ?? undefined,
          validTo: approvalEnd ?? undefined,
          notes,
        },
        create: {
          submissionId,
          decision: decisionRecord,
          decidedAt: decisionDate,
          validFrom: approvalStart ?? undefined,
          validTo: approvalEnd ?? undefined,
          notes,
        },
      });
    }

    await tx.submissionStatusHistory.create({
      data: {
        submissionId,
        oldStatus: submission.status,
        newStatus: nextStatus,
        reason: notes,
        changedById: actorId,
      },
    });

    return tx.submission.update({
      where: { id: submissionId },
      data: {
        status: nextStatus,
        finalDecision: decisionRecord,
        finalDecisionDate: decisionDate,
        resultsNotifiedAt,
        revisionDueDate,
        remarks: notes,
        project: {
          update: {
            overallStatus: projectStatus ?? undefined,
            approvalStartDate:
              finalDecision === ReviewDecision.APPROVED
                ? approvalStart ?? decisionDate
                : approvalStart ?? undefined,
            approvalEndDate: approvalEnd ?? undefined,
          },
        },
      },
      include: {
        project: {
          select: submissionProjectUpdateResultSelect,
        },
      },
    });
  });

  await logAuditEvent({
    actorId,
    action: "FINAL_DECISION_RECORDED",
    entityType: "Submission",
    entityId: submissionId,
    metadata: { finalDecision: data.finalDecision, nextStatus, resultsNotifiedAt: resultsNotifiedAt.toISOString() },
  });
  return updated;
}

/* ------------------------------------------------------------------ */
/*  SLA summary                                                        */
/* ------------------------------------------------------------------ */
export async function getSlaSummary(id: number) {
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      project: {
        select: submissionProjectSlaSelect,
      },
      classification: true,
      statusHistory: { orderBy: { effectiveDate: "asc" } },
      reviews: true,
      reviewAssignments: true,
    },
  });
  if (!submission) throw new AppError(404, "NOT_FOUND", "Submission not found");
  if (!submission.project?.committee) {
    throw new AppError(400, "NO_COMMITTEE", "Submission has no committee");
  }
  const [configs, holidayRows] = await Promise.all([
    prisma.configSLA.findMany({
      where: {
        committeeId: submission.project.committeeId,
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
    prisma.holiday.findMany({
      select: { date: true },
    }),
  ]);

  return buildSubmissionSlaSummary(
    submission,
    configs,
    holidayRows.map((row) => row.date)
  );
}
