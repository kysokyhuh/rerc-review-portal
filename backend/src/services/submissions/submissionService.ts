/**
 * Submission service — business logic extracted from submissionRoutes.
 */
import prisma from "../../config/prismaClient";
import {
  ProjectStatus,
  ReviewDecision,
  ReviewType,
  SubmissionDocumentStatus,
  SubmissionStatus,
  type SubmissionDocumentType,
} from "../../generated/prisma/client";
import { addWorkingDays, workingDaysBetween } from "../../utils/slaUtils";
import { AppError } from "../../middleware/errorHandler";
import { logAuditEvent } from "../audit/auditService";

const WORKFLOW_STAGE_ORDER: SubmissionStatus[] = [
  SubmissionStatus.AWAITING_CLASSIFICATION,
  SubmissionStatus.UNDER_CLASSIFICATION,
  SubmissionStatus.CLASSIFIED,
];

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

const nextScreeningStatusSet = new Set<SubmissionStatus>([
  SubmissionStatus.RETURNED_FOR_COMPLETION,
  SubmissionStatus.NOT_ACCEPTED,
  SubmissionStatus.AWAITING_CLASSIFICATION,
  SubmissionStatus.UNDER_CLASSIFICATION,
  SubmissionStatus.CLASSIFIED,
]);

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
      if (previousStatus !== nextStatus) {
        await tx.submission.update({
          where: { id: submissionId },
          data: { status: nextStatus },
        });
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
        data: { status: SubmissionStatus.CLASSIFIED },
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
export async function getSubmissionById(id: number) {
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      project: {
        include: {
          committee: true,
          protocolProfile: true,
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
        },
      },
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
    where: { id }, select: { status: true },
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
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { classification: true },
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
    const revisionSlaConfig = await prisma.configSLA.findFirst({
      where: {
        committeeId: submission.project.committeeId,
        stage: "REVISION_RESPONSE",
        reviewType: null,
        isActive: true,
      },
    });
    const revisionDays = revisionSlaConfig?.workingDays ?? 7;
    nextStatus = SubmissionStatus.AWAITING_REVISIONS;
    revisionDueDate = addWorkingDays(resultsNotifiedAt, revisionDays);
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
      include: { project: true },
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

  const findFirstStatus = (predicate: (entry: any) => boolean) => {
    for (const entry of statusHistoryAsc) {
      if (predicate(entry)) return entry;
    }
    return undefined;
  };

  // Completeness SLA
  const completenessSlaConfig = await prisma.configSLA.findFirst({
    where: { committeeId, stage: "COMPLETENESS", reviewType: null, isActive: true },
  });
  const completenessEndHistory = findFirstStatus((h: any) =>
    nextScreeningStatusSet.has(h.newStatus)
  );
  const completenessStart = submission.receivedDate ?? submission.createdAt;
  const completenessEnd = completenessEndHistory?.effectiveDate ?? null;
  const completenessActual =
    completenessEnd && completenessSlaConfig
      ? workingDaysBetween(new Date(completenessStart), new Date(completenessEnd), [])
      : null;
  const completenessConfigured = completenessSlaConfig?.workingDays ?? null;
  const completenessWithin =
    completenessConfigured === null || completenessActual === null
      ? null
      : completenessActual <= completenessConfigured;

  // Classification SLA
  const classificationSlaConfig = await prisma.configSLA.findFirst({
    where: { committeeId, stage: "CLASSIFICATION", reviewType, isActive: true },
  });
  const classificationStartHistory = findFirstStatus(
    (h: any) =>
      h.newStatus === SubmissionStatus.AWAITING_CLASSIFICATION ||
      h.newStatus === SubmissionStatus.UNDER_CLASSIFICATION
  );
  const classificationStart =
    classificationStartHistory?.effectiveDate ?? completenessEnd ?? submission.receivedDate ?? submission.createdAt;
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
    completeness: {
      start: completenessStart,
      end: completenessEnd,
      configuredWorkingDays: completenessConfigured,
      actualWorkingDays: completenessActual,
      withinSla: completenessWithin,
      description: completenessSlaConfig?.description ?? null,
    },
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
