"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Submission and review routes
 */
const express_1 = require("express");
const prismaClient_1 = __importDefault(require("../config/prismaClient"));
const client_1 = require("../generated/prisma/client");
const slaUtils_1 = require("../utils/slaUtils");
const router = (0, express_1.Router)();
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
                message: `Invalid reviewType. Allowed: ${allowedReviewTypes.join(", ")}`,
            });
        }
        const classifiedAt = new Date(classificationDate);
        // Optional: verify the submission exists
        const submission = await prismaClient_1.default.submission.findUnique({
            where: { id: submissionId },
        });
        if (!submission) {
            return res.status(404).json({ message: "Submission not found" });
        }
        // For FULL_BOARD, panelId should be provided; for EXEMPT/EXPEDITED, it's optional
        const classification = await prismaClient_1.default.classification.upsert({
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
    }
    catch (error) {
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
        const submission = await prismaClient_1.default.submission.findUnique({
            where: { id },
            include: {
                project: true,
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
            },
        });
        if (!submission) {
            return res.status(404).json({ message: "Submission not found" });
        }
        res.json(submission);
    }
    catch (error) {
        console.error("Error fetching submission:", error);
        res.status(500).json({ message: "Failed to fetch submission" });
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
        const submission = await prismaClient_1.default.submission.findUnique({
            where: { id },
            select: {
                status: true,
            },
        });
        if (!submission) {
            return res.status(404).json({ message: "Submission not found" });
        }
        const changedById = 1; // TODO: replace with authenticated user later
        const [history, updated] = await prismaClient_1.default.$transaction([
            prismaClient_1.default.submissionStatusHistory.create({
                data: {
                    submissionId: id,
                    oldStatus: submission.status,
                    newStatus,
                    reason,
                    changedById,
                },
            }),
            prismaClient_1.default.submission.update({
                where: { id },
                data: { status: newStatus },
            }),
        ]);
        res.json({ submission: updated, history });
    }
    catch (error) {
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
        const submission = await prismaClient_1.default.submission.findUnique({
            where: { id: submissionId },
        });
        if (!submission) {
            return res.status(404).json({ message: "Submission not found" });
        }
        const reviewer = await prismaClient_1.default.user.findUnique({
            where: { id: reviewerId },
        });
        if (!reviewer) {
            return res.status(404).json({ message: "Reviewer not found" });
        }
        const review = await prismaClient_1.default.review.create({
            data: {
                submissionId,
                reviewerId,
                isPrimary,
            },
        });
        res.status(201).json(review);
    }
    catch (error) {
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
        const existingReview = await prismaClient_1.default.review.findUnique({
            where: { id: reviewId },
        });
        if (!existingReview) {
            return res.status(404).json({ message: "Review not found" });
        }
        const updatedReview = await prismaClient_1.default.review.update({
            where: { id: reviewId },
            data: {
                decision,
                remarks,
                respondedAt: new Date(),
            },
        });
        res.json(updatedReview);
    }
    catch (error) {
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
        const { finalDecision, finalDecisionDate, approvalStartDate, approvalEndDate, } = req.body;
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
                message: `Invalid finalDecision. Allowed: ${allowedDecisions.join(", ")}`,
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
        const submission = await prismaClient_1.default.submission.update({
            where: { id: submissionId },
            data: {
                finalDecision,
                finalDecisionDate: decisionDate,
                project: approvalStart || approvalEnd
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
    }
    catch (error) {
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
        const submission = await prismaClient_1.default.submission.findUnique({
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
        const classificationSlaConfig = await prismaClient_1.default.configSLA.findFirst({
            where: {
                committeeId,
                stage: "CLASSIFICATION",
                reviewType,
                isActive: true,
            },
        });
        const classificationStartHistory = submission.statusHistory.find((history) => history.newStatus === client_1.SubmissionStatus.UNDER_CLASSIFICATION);
        const classificationStart = classificationStartHistory?.effectiveDate ?? submission.receivedDate;
        const classificationEnd = submission.classification.classificationDate ?? new Date();
        const classificationActual = (0, slaUtils_1.workingDaysBetween)(new Date(classificationStart), new Date(classificationEnd));
        const classificationConfigured = classificationSlaConfig?.workingDays ?? null;
        const classificationWithin = classificationConfigured === null
            ? null
            : classificationActual <= classificationConfigured;
        const reviewSlaConfig = await prismaClient_1.default.configSLA.findFirst({
            where: {
                committeeId,
                stage: "REVIEW",
                reviewType,
                isActive: true,
            },
        });
        const reviewStartHistory = submission.statusHistory.find((history) => history.newStatus === client_1.SubmissionStatus.UNDER_REVIEW);
        const reviewStart = reviewStartHistory?.effectiveDate ?? null;
        const reviewEndHistory = submission.statusHistory.find((history) => {
            const status = history.newStatus;
            if (!status) {
                return false;
            }
            return (status === client_1.SubmissionStatus.AWAITING_REVISIONS ||
                status === client_1.SubmissionStatus.REVISION_SUBMITTED ||
                status === client_1.SubmissionStatus.CLOSED ||
                status === client_1.SubmissionStatus.WITHDRAWN);
        });
        const reviewEnd = reviewEndHistory?.effectiveDate ?? null;
        let reviewActual = null;
        let reviewWithin = null;
        if (reviewStart && reviewEnd && reviewSlaConfig) {
            reviewActual = (0, slaUtils_1.workingDaysBetween)(new Date(reviewStart), new Date(reviewEnd));
            reviewWithin = reviewActual <= reviewSlaConfig.workingDays;
        }
        const revisionSlaConfig = await prismaClient_1.default.configSLA.findFirst({
            where: {
                committeeId,
                stage: "REVISION_RESPONSE",
                reviewType: null,
                isActive: true,
            },
        });
        const revisionStartHistory = submission.statusHistory.find((history) => history.newStatus === client_1.SubmissionStatus.AWAITING_REVISIONS);
        const revisionEndHistory = submission.statusHistory.find((history) => history.newStatus === client_1.SubmissionStatus.REVISION_SUBMITTED);
        const revisionStart = revisionStartHistory?.effectiveDate ?? null;
        const revisionEnd = revisionEndHistory?.effectiveDate ?? null;
        let revisionActual = null;
        let revisionWithin = null;
        if (revisionStart && revisionEnd && revisionSlaConfig) {
            revisionActual = (0, slaUtils_1.workingDaysBetween)(new Date(revisionStart), new Date(revisionEnd));
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
    }
    catch (error) {
        console.error("Error building SLA summary:", error);
        res.status(500).json({ message: "Failed to build SLA summary" });
    }
});
exports.default = router;
