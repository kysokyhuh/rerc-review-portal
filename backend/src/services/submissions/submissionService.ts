/**
 * Submission service — business logic extracted from submissionRoutes.
 */
import prisma from "../../config/prismaClient";
import { SubmissionStatus, ReviewType, ReviewDecision } from "../../generated/prisma/client";
import { workingDaysBetween } from "../../utils/slaUtils";
import { AppError } from "../../middleware/errorHandler";
import { logAuditEvent } from "../audit/auditService";

/* ------------------------------------------------------------------ */
/*  Classify                                                           */
/* ------------------------------------------------------------------ */
export async function classifySubmission(
  submissionId: number,
  data: {
    reviewType: ReviewType;
    classificationDate: string;
    panelId?: number | null;
    rationale?: string;
  },
  classifiedById: number
) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
  });
  if (!submission) throw new AppError(404, "NOT_FOUND", "Submission not found");

  const classificationDate = new Date(data.classificationDate);
  if (Number.isNaN(classificationDate.getTime())) {
    throw new AppError(400, "INVALID_DATE", "Invalid classificationDate");
  }

  const result = await prisma.$transaction(async (tx) => {
    const classification = await tx.classification.upsert({
      where: { submissionId },
      update: {
        reviewType: data.reviewType,
        classificationDate,
        panelId: data.panelId ?? null,
        rationale: data.rationale,
        classifiedById,
      },
      create: {
        submissionId,
        reviewType: data.reviewType,
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
        data: { status: SubmissionStatus.CLASSIFIED },
      });
      await tx.submissionStatusHistory.create({
        data: {
          submissionId,
          oldStatus: previousStatus,
          newStatus: SubmissionStatus.CLASSIFIED,
          reason: `Classified as ${data.reviewType}`,
          changedById: classifiedById,
        },
      });
    }
    return classification;
  });

  await logAuditEvent({
    actorId: classifiedById,
    action: "SUBMISSION_CLASSIFIED",
    entityType: "Submission",
    entityId: submissionId,
    metadata: { reviewType: data.reviewType, panelId: data.panelId ?? null },
  });

  return result;
}

/* ------------------------------------------------------------------ */
/*  Get by ID                                                          */
/* ------------------------------------------------------------------ */
export async function getSubmissionById(id: number) {
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      project: { include: { committee: true, protocolProfile: true } },
      classification: { include: { panel: true, classifiedBy: true } },
      reviews: { include: { reviewer: true }, orderBy: { assignedAt: "asc" } },
      reviewAssignments: {
        include: { reviewer: true },
        orderBy: [{ roundSequence: "asc" }, { assignedAt: "asc" }],
      },
      documents: { orderBy: [{ type: "asc" }, { createdAt: "asc" }] },
      statusHistory: {
        include: { changedBy: true },
        orderBy: { effectiveDate: "asc" },
      },
      changeLogs: {
        include: { changedBy: true },
        orderBy: { createdAt: "desc" },
      },
      projectChangeLogs: {
        include: { changedBy: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!submission) throw new AppError(404, "NOT_FOUND", "Submission not found");
  return submission;
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
    submissionType, receivedDate, status, finalDecision,
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

  const allowedStatuses = [
    "RECEIVED", "UNDER_COMPLETENESS_CHECK", "AWAITING_CLASSIFICATION",
    "UNDER_CLASSIFICATION", "CLASSIFIED", "UNDER_REVIEW",
    "AWAITING_REVISIONS", "REVISION_SUBMITTED", "CLOSED", "WITHDRAWN",
  ];
  if (status && !allowedStatuses.includes(String(status))) {
    throw new AppError(400, "INVALID_STATUS",
      `Invalid status. Allowed: ${allowedStatuses.join(", ")}`);
  }

  const submission = await prisma.submission.findUnique({
    where: { id },
    include: { project: true },
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

  const isValidStatus = (value: any): value is SubmissionStatus =>
    Object.values(SubmissionStatus).includes(value as SubmissionStatus);
  const statusChanged =
    status && status !== submission.status && isValidStatus(status)
      ? (status as SubmissionStatus) : null;
  if (status && !statusChanged && status !== submission.status) {
    throw new AppError(400, "INVALID_STATUS", "Invalid status value");
  }
  if (statusChanged) submissionUpdate.status = statusChanged;

  const hasUpdates =
    Object.keys(submissionUpdate).length > 0 ||
    Object.keys(projectUpdate).length > 0 ||
    statusChanged || changeLogs.length > 0 || projectChangeLogs.length > 0;
  if (!hasUpdates) {
    throw new AppError(400, "NO_CHANGES", "No changes to update");
  }

  const operations: any[] = [];
  if (statusChanged) {
    operations.push(
      prisma.submissionStatusHistory.create({
        data: {
          submissionId: submission.id, oldStatus: submission.status,
          newStatus: statusChanged, reason: changeReason ?? null, changedById,
        },
      })
    );
  }
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

  return prisma.submission.findUnique({
    where: { id: submission.id },
    include: {
      project: { include: { committee: true } },
      classification: { include: { panel: true, classifiedBy: true } },
      reviews: { include: { reviewer: true }, orderBy: { assignedAt: "asc" } },
      reviewAssignments: {
        include: { reviewer: true },
        orderBy: [{ roundSequence: "asc" }, { assignedAt: "asc" }],
      },
      documents: { orderBy: [{ type: "asc" }, { createdAt: "asc" }] },
      statusHistory: { include: { changedBy: true }, orderBy: { effectiveDate: "asc" } },
      changeLogs: { include: { changedBy: true }, orderBy: { createdAt: "desc" } },
      projectChangeLogs: { include: { changedBy: true }, orderBy: { createdAt: "desc" } },
    },
  });
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
    where: { id }, select: { status: true },
  });
  if (!submission) throw new AppError(404, "NOT_FOUND", "Submission not found");

  const [history, updated] = await prisma.$transaction([
    prisma.submissionStatusHistory.create({
      data: { submissionId: id, oldStatus: submission.status, newStatus, reason, changedById },
    }),
    prisma.submission.update({ where: { id }, data: { status: newStatus } }),
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
  actorId: number
) {
  const submission = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (!submission) throw new AppError(404, "NOT_FOUND", "Submission not found");

  const reviewer = await prisma.user.findUnique({ where: { id: reviewerId } });
  if (!reviewer) throw new AppError(404, "NOT_FOUND", "Reviewer not found");

  const review = await prisma.review.create({
    data: { submissionId, reviewerId, isPrimary },
  });
  await logAuditEvent({
    actorId,
    action: "REVIEWER_ASSIGNED",
    entityType: "Submission",
    entityId: submissionId,
    metadata: { reviewerId, isPrimary },
  });
  return review;
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
  const existing = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!existing) throw new AppError(404, "NOT_FOUND", "Review not found");

  const updated = await prisma.review.update({
    where: { id: reviewId },
    data: { decision, remarks, respondedAt: new Date() },
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
  },
  actorId: number
) {
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

  const updated = await prisma.submission.update({
    where: { id: submissionId },
    data: {
      finalDecision: data.finalDecision as any,
      finalDecisionDate: decisionDate,
      project: (approvalStart || approvalEnd)
        ? { update: { approvalStartDate: approvalStart ?? undefined, approvalEndDate: approvalEnd ?? undefined } }
        : undefined,
    },
    include: { project: true },
  });
  await logAuditEvent({
    actorId,
    action: "FINAL_DECISION_RECORDED",
    entityType: "Submission",
    entityId: submissionId,
    metadata: { finalDecision: data.finalDecision },
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
      project: { include: { committee: true } },
      classification: true,
      statusHistory: { orderBy: { effectiveDate: "asc" } },
      reviews: true,
    },
  });
  if (!submission) throw new AppError(404, "NOT_FOUND", "Submission not found");
  if (!submission.project?.committee) {
    throw new AppError(400, "NO_COMMITTEE", "Submission has no committee");
  }
  if (!submission.classification) {
    throw new AppError(400, "NOT_CLASSIFIED", "Submission has not been classified yet");
  }

  const committeeId = submission.project.committeeId;
  const reviewType = submission.classification.reviewType;
  const statusHistoryAsc = submission.statusHistory;

  const findLatestStatus = (predicate: (entry: any) => boolean) => {
    for (let i = statusHistoryAsc.length - 1; i >= 0; i--) {
      if (predicate(statusHistoryAsc[i])) return statusHistoryAsc[i];
    }
    return undefined;
  };

  // Classification SLA
  const classificationSlaConfig = await prisma.configSLA.findFirst({
    where: { committeeId, stage: "CLASSIFICATION", reviewType, isActive: true },
  });
  const classificationStartHistory = findLatestStatus(
    (h: any) => h.newStatus === SubmissionStatus.UNDER_CLASSIFICATION
  );
  const classificationStart =
    classificationStartHistory?.effectiveDate ?? submission.receivedDate ?? submission.createdAt;
  const classificationEnd = submission.classification.classificationDate ?? new Date();
  const classificationActual = workingDaysBetween(
    new Date(classificationStart), new Date(classificationEnd), []
  );
  const classificationConfigured = classificationSlaConfig?.workingDays ?? null;
  const classificationWithin = classificationConfigured === null
    ? null : classificationActual <= classificationConfigured;

  // Review SLA
  const reviewSlaConfig = await prisma.configSLA.findFirst({
    where: { committeeId, stage: "REVIEW", reviewType, isActive: true },
  });
  const reviewStartHistory = findLatestStatus(
    (h: any) => h.newStatus === SubmissionStatus.UNDER_REVIEW
  );
  const reviewStart = reviewStartHistory?.effectiveDate ?? null;
  const reviewEndHistory = findLatestStatus((h: any) => {
    const s = h.newStatus;
    return s === SubmissionStatus.AWAITING_REVISIONS ||
      s === SubmissionStatus.REVISION_SUBMITTED ||
      s === SubmissionStatus.CLOSED || s === SubmissionStatus.WITHDRAWN;
  });
  const reviewEnd = reviewEndHistory?.effectiveDate ?? null;

  let reviewActual: number | null = null;
  let reviewWithin: boolean | null = null;
  if (reviewStart && reviewEnd && reviewSlaConfig) {
    reviewActual = workingDaysBetween(new Date(reviewStart), new Date(reviewEnd), []);
    reviewWithin = reviewActual <= reviewSlaConfig.workingDays;
  }

  // Revision SLA
  const revisionSlaConfig = await prisma.configSLA.findFirst({
    where: { committeeId, stage: "REVISION_RESPONSE", reviewType: null, isActive: true },
  });
  const revisionStartHistory = findLatestStatus(
    (h: any) => h.newStatus === SubmissionStatus.AWAITING_REVISIONS
  );
  const revisionEndHistory = findLatestStatus(
    (h: any) => h.newStatus === SubmissionStatus.REVISION_SUBMITTED
  );
  const revisionStart = revisionStartHistory?.effectiveDate ?? null;
  const revisionEnd = revisionEndHistory?.effectiveDate ?? null;

  let revisionActual: number | null = null;
  let revisionWithin: boolean | null = null;
  if (revisionStart && revisionEnd && revisionSlaConfig) {
    revisionActual = workingDaysBetween(new Date(revisionStart), new Date(revisionEnd), []);
    revisionWithin = revisionActual <= revisionSlaConfig.workingDays;
  }

  return {
    submissionId: submission.id,
    committeeCode: submission.project.committee.code,
    reviewType,
    classification: {
      start: classificationStart, end: classificationEnd,
      configuredWorkingDays: classificationConfigured,
      actualWorkingDays: classificationActual,
      withinSla: classificationWithin,
      description: classificationSlaConfig?.description ?? null,
    },
    review: {
      start: reviewStart, end: reviewEnd,
      configuredWorkingDays: reviewSlaConfig?.workingDays ?? null,
      actualWorkingDays: reviewActual,
      withinSla: reviewWithin,
      description: reviewSlaConfig?.description ?? null,
    },
    revisionResponse: {
      start: revisionStart, end: revisionEnd,
      configuredWorkingDays: revisionSlaConfig?.workingDays ?? null,
      actualWorkingDays: revisionActual,
      withinSla: revisionWithin,
      description: revisionSlaConfig?.description ?? null,
    },
  };
}
