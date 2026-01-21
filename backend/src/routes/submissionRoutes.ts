/**
 * Submission and review routes
 */
import { Router } from "express";
import prisma from "../config/prismaClient";
import { SubmissionStatus } from "../generated/prisma/client";
import { workingDaysBetween } from "../utils/slaUtils";

const router = Router();

// Classify a submission (EXEMPT / EXPEDITED / FULL_BOARD)
router.post("/submissions/:submissionId/classifications", async (req, res) => {
  try {
    const submissionId = Number(req.params.submissionId);
    if (Number.isNaN(submissionId)) {
      return res.status(400).json({ message: "Invalid submissionId" });
    }

    const { reviewType, classificationDate, panelId, rationale } = req.body;

    if (!reviewType || !classificationDate) {
      return res.status(400).json({
        message: "reviewType and classificationDate are required",
      });
    }

    const allowedReviewTypes = ["EXEMPT", "EXPEDITED", "FULL_BOARD"];
    if (!allowedReviewTypes.includes(reviewType)) {
      return res.status(400).json({
        message: `Invalid reviewType. Allowed: ${allowedReviewTypes.join(
          ", "
        )}`,
      });
    }

    const classifiedAt = new Date(classificationDate);

    // Optional: verify the submission exists
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
    });
    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    // For FULL_BOARD, panelId should be provided; for EXEMPT/EXPEDITED, it's optional
    const classification = await prisma.classification.upsert({
      where: { submissionId }, // there should be max 1 per submission
      update: {
        reviewType,
        classificationDate: classifiedAt,
        panelId: panelId ?? null,
        rationale,
        classifiedById: 1, // RA/Chair for now
      },
      create: {
        submissionId,
        reviewType,
        classificationDate: classifiedAt,
        panelId: panelId ?? null,
        rationale,
        classifiedById: 1,
      },
    });

    res.status(201).json(classification);
  } catch (error) {
    console.error("Error classifying submission:", error);
    res.status(500).json({ message: "Failed to classify submission" });
  }
});

// Get a submission with its classification
router.get("/submissions/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid submission id" });
    }

    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            committee: true,
          },
        },
        classification: {
          include: {
            panel: true,
            classifiedBy: true,
          },
        },
        reviews: {
          include: {
            reviewer: true,
          },
          orderBy: { assignedAt: "asc" },
        },
        statusHistory: {
          include: {
            changedBy: true,
          },
          orderBy: { effectiveDate: "asc" },
        },
        changeLogs: {
          include: {
            changedBy: true,
          },
          orderBy: { createdAt: "desc" },
        },
        projectChangeLogs: {
          include: {
            changedBy: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    res.json(submission);
  } catch (error) {
    console.error("Error fetching submission:", error);
    res.status(500).json({ message: "Failed to fetch submission" });
  }
});

// Update submission overview fields and log changes
router.patch("/submissions/:id/overview", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid submission id" });
    }

    const {
      submissionType,
      receivedDate,
      status,
      finalDecision,
      finalDecisionDate,
      piName,
      committeeId,
      changeReason,
    } = req.body;

    const allowedSubmissionTypes = [
      "INITIAL",
      "AMENDMENT",
      "CONTINUING_REVIEW",
      "FINAL_REPORT",
      "WITHDRAWAL",
      "SAFETY_REPORT",
      "PROTOCOL_DEVIATION",
    ];
    if (
      submissionType &&
      !allowedSubmissionTypes.includes(String(submissionType))
    ) {
      return res.status(400).json({
        message: `Invalid submissionType. Allowed: ${allowedSubmissionTypes.join(
          ", "
        )}`,
      });
    }

    const allowedStatuses = [
      "RECEIVED",
      "UNDER_COMPLETENESS_CHECK",
      "AWAITING_CLASSIFICATION",
      "UNDER_CLASSIFICATION",
      "CLASSIFIED",
      "UNDER_REVIEW",
      "AWAITING_REVISIONS",
      "REVISION_SUBMITTED",
      "CLOSED",
      "WITHDRAWN",
    ];
    if (status && !allowedStatuses.includes(String(status))) {
      return res.status(400).json({
        message: `Invalid status. Allowed: ${allowedStatuses.join(", ")}`,
      });
    }

    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    const changedById = 1; // TODO: replace with authenticated user later
    const submissionUpdate: Record<string, any> = {};
    const projectUpdate: Record<string, any> = {};
    const changeLogs: Array<{
      submissionId: number;
      fieldName: string;
      oldValue: string | null;
      newValue: string | null;
      reason?: string | null;
      changedById?: number;
    }> = [];
    const projectChangeLogs: Array<{
      projectId: number;
      fieldName: string;
      oldValue: string | null;
      newValue: string | null;
      reason?: string | null;
      sourceSubmissionId?: number;
      changedById?: number;
    }> = [];

    if (
      submissionType &&
      submissionType !== submission.submissionType
    ) {
      submissionUpdate.submissionType = submissionType;
      changeLogs.push({
        submissionId: submission.id,
        fieldName: "submissionType",
        oldValue: submission.submissionType,
        newValue: submissionType,
        reason: changeReason ?? null,
        changedById,
      });
    }

    if (receivedDate) {
      const parsedReceived = new Date(receivedDate);
      if (Number.isNaN(parsedReceived.getTime())) {
        return res
          .status(400)
          .json({ message: "Invalid receivedDate" });
      }
      const oldValue = submission.receivedDate?.toISOString() ?? null;
      const newValue = parsedReceived.toISOString();
      if (oldValue !== newValue) {
        submissionUpdate.receivedDate = parsedReceived;
        changeLogs.push({
          submissionId: submission.id,
          fieldName: "receivedDate",
          oldValue,
          newValue,
          reason: changeReason ?? null,
          changedById,
        });
      }
    }

    if (
      finalDecision !== undefined &&
      finalDecision !== submission.finalDecision
    ) {
      submissionUpdate.finalDecision = finalDecision;
      changeLogs.push({
        submissionId: submission.id,
        fieldName: "finalDecision",
        oldValue: submission.finalDecision ?? null,
        newValue: finalDecision ?? null,
        reason: changeReason ?? null,
        changedById,
      });
    }

    if (finalDecisionDate !== undefined) {
      const parsedDecisionDate =
        finalDecisionDate === null ? null : new Date(finalDecisionDate);
      if (
        finalDecisionDate !== null &&
        Number.isNaN(parsedDecisionDate?.getTime())
      ) {
        return res
          .status(400)
          .json({ message: "Invalid finalDecisionDate" });
      }
      const oldValue = submission.finalDecisionDate
        ? submission.finalDecisionDate.toISOString()
        : null;
      const newValue = parsedDecisionDate
        ? parsedDecisionDate.toISOString()
        : null;
      if (oldValue !== newValue) {
        submissionUpdate.finalDecisionDate = parsedDecisionDate;
        changeLogs.push({
          submissionId: submission.id,
          fieldName: "finalDecisionDate",
          oldValue,
          newValue,
          reason: changeReason ?? null,
          changedById,
        });
      }
    }

    if (submission.project) {
      if (piName && piName !== submission.project.piName) {
        projectUpdate.piName = piName;
        projectChangeLogs.push({
          projectId: submission.project.id,
          fieldName: "piName",
          oldValue: submission.project.piName,
          newValue: piName,
          reason: changeReason ?? null,
          sourceSubmissionId: submission.id,
          changedById,
        });
      }
      if (committeeId) {
        const parsedCommitteeId = Number(committeeId);
        if (Number.isNaN(parsedCommitteeId)) {
          return res
            .status(400)
            .json({ message: "Invalid committeeId" });
        }
        const committeeExists = await prisma.committee.findUnique({
          where: { id: parsedCommitteeId },
          select: { id: true },
        });
        if (!committeeExists) {
          return res.status(400).json({ message: "committeeId does not exist" });
        }
        if (parsedCommitteeId !== submission.project.committeeId) {
          projectUpdate.committeeId = parsedCommitteeId;
          projectChangeLogs.push({
            projectId: submission.project.id,
            fieldName: "committeeId",
            oldValue: submission.project.committeeId
              ? String(submission.project.committeeId)
              : null,
            newValue: String(parsedCommitteeId),
            reason: changeReason ?? null,
            sourceSubmissionId: submission.id,
            changedById,
          });
        }
      }
    } else if (piName || committeeId) {
      return res
        .status(400)
        .json({ message: "Submission is not linked to a project" });
    }

    const isValidStatus = (value: any): value is SubmissionStatus =>
      Object.values(SubmissionStatus).includes(value as SubmissionStatus);
    const statusChanged =
      status && status !== submission.status && isValidStatus(status)
        ? (status as SubmissionStatus)
        : null;
    if (status && !statusChanged && status !== submission.status) {
      return res.status(400).json({ message: "Invalid status value" });
    }
    if (statusChanged) {
      submissionUpdate.status = statusChanged;
    }

    const hasUpdates =
      Object.keys(submissionUpdate).length > 0 ||
      Object.keys(projectUpdate).length > 0 ||
      statusChanged ||
      changeLogs.length > 0 ||
      projectChangeLogs.length > 0;

    if (!hasUpdates) {
      return res.status(400).json({ message: "No changes to update" });
    }

    const operations = [];
    if (statusChanged) {
      operations.push(
        prisma.submissionStatusHistory.create({
          data: {
            submissionId: submission.id,
            oldStatus: submission.status,
            newStatus: statusChanged,
            reason: changeReason ?? null,
            changedById,
          },
        })
      );
    }
    if (Object.keys(submissionUpdate).length > 0) {
      operations.push(
        prisma.submission.update({
          where: { id: submission.id },
          data: submissionUpdate,
        })
      );
    }
    if (Object.keys(projectUpdate).length > 0 && submission.project) {
      operations.push(
        prisma.project.update({
          where: { id: submission.project.id },
          data: projectUpdate,
        })
      );
    }
    if (changeLogs.length > 0) {
      operations.push(
        prisma.submissionChangeLog.createMany({
          data: changeLogs,
        })
      );
    }
    if (projectChangeLogs.length > 0) {
      operations.push(
        prisma.projectChangeLog.createMany({
          data: projectChangeLogs,
        })
      );
    }

    await prisma.$transaction(operations);

    const refreshed = await prisma.submission.findUnique({
      where: { id: submission.id },
      include: {
        project: {
          include: {
            committee: true,
          },
        },
        classification: {
          include: {
            panel: true,
            classifiedBy: true,
          },
        },
        reviews: {
          include: {
            reviewer: true,
          },
          orderBy: { assignedAt: "asc" },
        },
        statusHistory: {
          include: {
            changedBy: true,
          },
          orderBy: { effectiveDate: "asc" },
        },
        changeLogs: {
          include: {
            changedBy: true,
          },
          orderBy: { createdAt: "desc" },
        },
        projectChangeLogs: {
          include: {
            changedBy: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    res.json(refreshed);
  } catch (error) {
    console.error("Error updating submission overview:", error);
    res.status(500).json({ message: "Failed to update submission" });
  }
});

// Change submission status and log history
router.patch("/submissions/:id/status", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid submission id" });
    }

    const { newStatus, reason } = req.body;

    const allowedStatuses = [
      "RECEIVED",
      "UNDER_COMPLETENESS_CHECK",
      "AWAITING_CLASSIFICATION",
      "UNDER_CLASSIFICATION",
      "CLASSIFIED",
      "UNDER_REVIEW",
      "AWAITING_REVISIONS",
      "REVISION_SUBMITTED",
      "CLOSED",
      "WITHDRAWN",
    ];

    if (!newStatus || !allowedStatuses.includes(newStatus)) {
      return res.status(400).json({
        message: `Invalid status. Allowed: ${allowedStatuses.join(", ")}`,
      });
    }

    const submission = await prisma.submission.findUnique({
      where: { id },
      select: {
        status: true,
      },
    });

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    const changedById = 1; // TODO: replace with authenticated user later

    const [history, updated] = await prisma.$transaction([
      prisma.submissionStatusHistory.create({
        data: {
          submissionId: id,
          oldStatus: submission.status,
          newStatus,
          reason,
          changedById,
        },
      }),
      prisma.submission.update({
        where: { id },
        data: { status: newStatus },
      }),
    ]);

    res.json({ submission: updated, history });
  } catch (error) {
    console.error("Error updating submission status:", error);
    res.status(500).json({ message: "Failed to update submission status" });
  }
});

// Assign a reviewer to a submission
router.post("/submissions/:submissionId/reviews", async (req, res) => {
  try {
    const submissionId = Number(req.params.submissionId);
    if (Number.isNaN(submissionId)) {
      return res.status(400).json({ message: "Invalid submissionId" });
    }

    const reviewerId = Number(req.body.reviewerId);
    if (Number.isNaN(reviewerId)) {
      return res.status(400).json({ message: "Invalid reviewerId" });
    }

    const isPrimary = Boolean(req.body.isPrimary);

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
    });
    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    const reviewer = await prisma.user.findUnique({
      where: { id: reviewerId },
    });
    if (!reviewer) {
      return res.status(404).json({ message: "Reviewer not found" });
    }

    const review = await prisma.review.create({
      data: {
        submissionId,
        reviewerId,
        isPrimary,
      },
    });

    res.status(201).json(review);
  } catch (error) {
    console.error("Error assigning reviewer:", error);
    res.status(500).json({ message: "Failed to assign reviewer" });
  }
});

// Record a decision for a review
router.post("/reviews/:reviewId/decision", async (req, res) => {
  try {
    const reviewId = Number(req.params.reviewId);
    if (Number.isNaN(reviewId)) {
      return res.status(400).json({ message: "Invalid reviewId" });
    }

    const { decision, remarks } = req.body;
    if (!decision) {
      return res.status(400).json({ message: "decision is required" });
    }

    const allowedDecisions = [
      "APPROVED",
      "MINOR_REVISIONS",
      "MAJOR_REVISIONS",
      "DISAPPROVED",
      "INFO_ONLY",
    ];
    if (!allowedDecisions.includes(decision)) {
      return res.status(400).json({
        message: `Invalid decision. Allowed: ${allowedDecisions.join(", ")}`,
      });
    }

    const existingReview = await prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!existingReview) {
      return res.status(404).json({ message: "Review not found" });
    }

    const updatedReview = await prisma.review.update({
      where: { id: reviewId },
      data: {
        decision,
        remarks,
        respondedAt: new Date(),
      },
    });

    res.json(updatedReview);
  } catch (error) {
    console.error("Error recording review decision:", error);
    res.status(500).json({ message: "Failed to record decision" });
  }
});

// Record final decision for a submission and update project approvals
router.post("/submissions/:id/final-decision", async (req, res) => {
  try {
    const submissionId = Number(req.params.id);
    if (Number.isNaN(submissionId)) {
      return res.status(400).json({ message: "Invalid submission id" });
    }

    const {
      finalDecision,
      finalDecisionDate,
      approvalStartDate,
      approvalEndDate,
    } = req.body;

    if (!finalDecision) {
      return res.status(400).json({ message: "finalDecision is required" });
    }

    const allowedDecisions = [
      "APPROVED",
      "MINOR_REVISIONS",
      "MAJOR_REVISIONS",
      "DISAPPROVED",
      "WITHDRAWN",
    ];

    if (!allowedDecisions.includes(finalDecision)) {
      return res.status(400).json({
        message: `Invalid finalDecision. Allowed: ${allowedDecisions.join(
          ", "
        )}`,
      });
    }

    let decisionDate = finalDecisionDate
      ? new Date(finalDecisionDate)
      : new Date();
    if (Number.isNaN(decisionDate.getTime())) {
      return res.status(400).json({ message: "Invalid finalDecisionDate" });
    }

    let approvalStart = approvalStartDate ? new Date(approvalStartDate) : null;
    if (approvalStart && Number.isNaN(approvalStart.getTime())) {
      return res.status(400).json({ message: "Invalid approvalStartDate" });
    }

    let approvalEnd = approvalEndDate ? new Date(approvalEndDate) : null;
    if (approvalEnd && Number.isNaN(approvalEnd.getTime())) {
      return res.status(400).json({ message: "Invalid approvalEndDate" });
    }

    const submission = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        finalDecision,
        finalDecisionDate: decisionDate,
        project:
          approvalStart || approvalEnd
            ? {
                update: {
                  approvalStartDate: approvalStart ?? undefined,
                  approvalEndDate: approvalEnd ?? undefined,
                },
              }
            : undefined,
      },
      include: {
        project: true,
      },
    });

    res.json(submission);
  } catch (error) {
    console.error("Error recording final decision:", error);
    res.status(500).json({ message: "Failed to record final decision" });
  }
});

// Summarize SLA compliance for a submission (currently classification SLA)
router.get("/submissions/:id/sla-summary", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid submission id" });
    }

    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        project: {
          include: { committee: true },
        },
        classification: true,
        statusHistory: {
          orderBy: { effectiveDate: "asc" },
        },
        reviews: true,
      },
    });

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    if (!submission.project?.committee) {
      return res.status(400).json({ message: "Submission has no committee" });
    }

    if (!submission.classification) {
      return res
        .status(400)
        .json({ message: "Submission has not been classified yet" });
    }

    const committeeId = submission.project.committeeId;
    const reviewType = submission.classification.reviewType; // EXEMPT / EXPEDITED / FULL_BOARD
    const statusHistoryAsc = submission.statusHistory;
    const findLatestStatus = (predicate: (entry: any) => boolean) => {
      for (let i = statusHistoryAsc.length - 1; i >= 0; i -= 1) {
        if (predicate(statusHistoryAsc[i])) {
          return statusHistoryAsc[i];
        }
      }
      return undefined;
    };

    const classificationSlaConfig = await prisma.configSLA.findFirst({
      where: {
        committeeId,
        stage: "CLASSIFICATION",
        reviewType,
        isActive: true,
      },
    });

    const classificationStartHistory = findLatestStatus(
      (history: any) =>
        history.newStatus === SubmissionStatus.UNDER_CLASSIFICATION
    );

    const classificationStart =
      classificationStartHistory?.effectiveDate ?? submission.receivedDate;

    const classificationEnd =
      submission.classification.classificationDate ?? new Date();

    const classificationActual = workingDaysBetween(
      new Date(classificationStart),
      new Date(classificationEnd)
    );

    const classificationConfigured =
      classificationSlaConfig?.workingDays ?? null;
    const classificationWithin =
      classificationConfigured === null
        ? null
        : classificationActual <= classificationConfigured;

    const reviewSlaConfig = await prisma.configSLA.findFirst({
      where: {
        committeeId,
        stage: "REVIEW",
        reviewType,
        isActive: true,
      },
    });

    const reviewStartHistory = findLatestStatus(
      (history: any) => history.newStatus === SubmissionStatus.UNDER_REVIEW
    );
    const reviewStart = reviewStartHistory?.effectiveDate ?? null;

    const reviewEndHistory = findLatestStatus((history: any) => {
      const status = history.newStatus;
      if (!status) {
        return false;
      }
      return (
        status === SubmissionStatus.AWAITING_REVISIONS ||
        status === SubmissionStatus.REVISION_SUBMITTED ||
        status === SubmissionStatus.CLOSED ||
        status === SubmissionStatus.WITHDRAWN
      );
    });
    const reviewEnd = reviewEndHistory?.effectiveDate ?? null;

    let reviewActual: number | null = null;
    let reviewWithin: boolean | null = null;
    if (reviewStart && reviewEnd && reviewSlaConfig) {
      reviewActual = workingDaysBetween(
        new Date(reviewStart),
        new Date(reviewEnd)
      );
      reviewWithin = reviewActual <= reviewSlaConfig.workingDays;
    }

    const revisionSlaConfig = await prisma.configSLA.findFirst({
      where: {
        committeeId,
        stage: "REVISION_RESPONSE",
        reviewType: null,
        isActive: true,
      },
    });

    const revisionStartHistory = findLatestStatus(
      (history: any) =>
        history.newStatus === SubmissionStatus.AWAITING_REVISIONS
    );
    const revisionEndHistory = findLatestStatus(
      (history: any) =>
        history.newStatus === SubmissionStatus.REVISION_SUBMITTED
    );

    const revisionStart = revisionStartHistory?.effectiveDate ?? null;
    const revisionEnd = revisionEndHistory?.effectiveDate ?? null;

    let revisionActual: number | null = null;
    let revisionWithin: boolean | null = null;
    if (revisionStart && revisionEnd && revisionSlaConfig) {
      revisionActual = workingDaysBetween(
        new Date(revisionStart),
        new Date(revisionEnd)
      );
      revisionWithin = revisionActual <= revisionSlaConfig.workingDays;
    }

    res.json({
      submissionId: submission.id,
      committeeCode: submission.project.committee.code,
      reviewType,
      classification: {
        start: classificationStart,
        end: classificationEnd,
        configuredWorkingDays: classificationConfigured,
        actualWorkingDays: classificationActual,
        withinSla: classificationWithin,
        description: classificationSlaConfig?.description ?? null,
      },
      review: {
        start: reviewStart,
        end: reviewEnd,
        configuredWorkingDays: reviewSlaConfig?.workingDays ?? null,
        actualWorkingDays: reviewActual,
        withinSla: reviewWithin,
        description: reviewSlaConfig?.description ?? null,
      },
      revisionResponse: {
        start: revisionStart,
        end: revisionEnd,
        configuredWorkingDays: revisionSlaConfig?.workingDays ?? null,
        actualWorkingDays: revisionActual,
        withinSla: revisionWithin,
        description: revisionSlaConfig?.description ?? null,
      },
    });
  } catch (error) {
    console.error("Error building SLA summary:", error);
    res.status(500).json({ message: "Failed to build SLA summary" });
  }
});

export default router;
