/**
 * Submission and review routes — thin controller layer
 */
import { Router } from "express";
import { RoleType } from "../generated/prisma/client";
import { requireAnyRole, requireRole, requireUser } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  requireAssignedReviewerByReviewId,
  requireSubmissionAccess,
} from "../middleware/reviewerScope";
import {
  acceptSubmissionForClassificationSchema,
  classifySubmissionSchema,
  resubmitSubmissionSchema,
  screeningOutcomeSchema,
  startCompletenessCheckSchema,
  submissionDocumentSchema,
  updateSubmissionOverviewSchema,
  updateSubmissionStatusSchema,
  createReviewSchema,
  reviewDecisionSchema,
  finalDecisionSchema,
  issueExemptionSchema,
  startReviewSchema,
} from "../schemas/submission";
import {
  acceptSubmissionForClassification,
  addSubmissionDocument,
  classifySubmission,
  getSubmissionById,
  markSubmissionNotAccepted,
  removeSubmissionDocument,
  resubmitSubmission,
  returnSubmissionForCompletion,
  startSubmissionCompletenessCheck,
  updateSubmissionOverview,
  updateSubmissionStatus,
  assignReviewer,
  recordReviewDecision,
  recordFinalDecision,
  getSlaSummary,
  startSubmissionReview,
} from "../services/submissions/submissionService";
import { issueExemptionAndClose } from "../services/exemptService";

const router = Router();

router.post(
  "/submissions/:id/screening/start",
  requireAnyRole([RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  validate(startCompletenessCheckSchema),
  async (req, res, next) => {
    try {
      const submissionId = Number(req.params.id);
      if (Number.isNaN(submissionId)) {
        return res.status(400).json({ message: "Invalid submission id" });
      }
      const result = await startSubmissionCompletenessCheck(submissionId, req.body, req.user!.id);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/submissions/:id/screening/return",
  requireAnyRole([RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  validate(screeningOutcomeSchema),
  async (req, res, next) => {
    try {
      const submissionId = Number(req.params.id);
      if (Number.isNaN(submissionId)) {
        return res.status(400).json({ message: "Invalid submission id" });
      }
      const result = await returnSubmissionForCompletion(submissionId, req.body, req.user!.id);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/submissions/:id/screening/not-accepted",
  requireAnyRole([RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  validate(screeningOutcomeSchema),
  async (req, res, next) => {
    try {
      const submissionId = Number(req.params.id);
      if (Number.isNaN(submissionId)) {
        return res.status(400).json({ message: "Invalid submission id" });
      }
      const result = await markSubmissionNotAccepted(submissionId, req.body, req.user!.id);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/submissions/:id/screening/accept",
  requireAnyRole([RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  validate(acceptSubmissionForClassificationSchema),
  async (req, res, next) => {
    try {
      const submissionId = Number(req.params.id);
      if (Number.isNaN(submissionId)) {
        return res.status(400).json({ message: "Invalid submission id" });
      }
      const result = await acceptSubmissionForClassification(submissionId, req.body, req.user!.id);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/submissions/:id/resubmit",
  requireUser,
  requireSubmissionAccess,
  validate(resubmitSubmissionSchema),
  async (req, res, next) => {
    try {
      const submissionId = Number(req.params.id);
      if (Number.isNaN(submissionId)) {
        return res.status(400).json({ message: "Invalid submission id" });
      }
      const result = await resubmitSubmission(submissionId, req.body, req.user!.id);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/submissions/:submissionId/documents",
  requireUser,
  requireSubmissionAccess,
  validate(submissionDocumentSchema),
  async (req, res, next) => {
    try {
      const submissionId = Number(req.params.submissionId);
      if (Number.isNaN(submissionId)) {
        return res.status(400).json({ message: "Invalid submission id" });
      }
      const result = await addSubmissionDocument(submissionId, req.body, req.user!.id);
      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  }
);

router.delete(
  "/submissions/:submissionId/documents/:documentId",
  requireUser,
  requireSubmissionAccess,
  async (req, res, next) => {
    try {
      const submissionId = Number(req.params.submissionId);
      const documentId = Number(req.params.documentId);
      if (Number.isNaN(submissionId) || Number.isNaN(documentId)) {
        return res.status(400).json({ message: "Invalid id" });
      }
      const result = await removeSubmissionDocument(submissionId, documentId, req.user!.id);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }
);

// Classify a submission (EXEMPT / EXPEDITED / FULL_BOARD)
router.post(
  "/submissions/:submissionId/classifications",
  requireAnyRole([RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  validate(classifySubmissionSchema),
  async (req, res, next) => {
    try {
      const submissionId = Number(req.params.submissionId);
      if (Number.isNaN(submissionId)) {
        return res.status(400).json({ message: "Invalid submissionId" });
      }
      const result = await classifySubmission(submissionId, req.body, req.user!.id);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get a submission with its classification
router.get("/submissions/:id", requireUser, requireSubmissionAccess, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid submission id" });
    }
    const submission = await getSubmissionById(id);
    res.json(submission);
  } catch (error) {
    next(error);
  }
});

// Update submission overview fields and log changes
router.patch(
  "/submissions/:id/overview",
  requireAnyRole([RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  validate(updateSubmissionOverviewSchema),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid submission id" });
      }
      const result = await updateSubmissionOverview(id, req.body, req.user!.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Change submission status and log history
router.patch(
  "/submissions/:id/status",
  requireAnyRole([RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  validate(updateSubmissionStatusSchema),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid submission id" });
      }
      const result = await updateSubmissionStatus(id, req.body.newStatus, req.body.reason, req.user!.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Assign a reviewer to a submission
router.post(
  "/submissions/:submissionId/reviews",
  requireAnyRole([RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  validate(createReviewSchema),
  async (req, res, next) => {
    try {
      const submissionId = Number(req.params.submissionId);
      if (Number.isNaN(submissionId)) {
        return res.status(400).json({ message: "Invalid submissionId" });
      }
      const result = await assignReviewer(
        submissionId,
        req.body.reviewerId,
        Boolean(req.body.isPrimary),
        req.body.reviewerRole,
        req.body.dueDate,
        req.user!.id
      );
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Record a decision for a review
router.post(
  "/reviews/:reviewId/decision",
  requireRole(RoleType.RESEARCH_ASSISTANT),
  requireAssignedReviewerByReviewId,
  validate(reviewDecisionSchema),
  async (req, res, next) => {
    try {
      const reviewId = Number(req.params.reviewId);
      if (Number.isNaN(reviewId)) {
        return res.status(400).json({ message: "Invalid reviewId" });
      }
      const result = await recordReviewDecision(
        reviewId,
        req.body.decision,
        req.user!.id,
        req.body.remarks
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Record final decision for a submission and update project approvals
router.post(
  "/submissions/:id/start-review",
  requireAnyRole([RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  validate(startReviewSchema),
  async (req, res, next) => {
    try {
      const submissionId = Number(req.params.id);
      if (Number.isNaN(submissionId)) {
        return res.status(400).json({ message: "Invalid submission id" });
      }
      const result = await startSubmissionReview(submissionId, req.user!.id);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/submissions/:id/issue-exemption",
  requireAnyRole([RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  validate(issueExemptionSchema),
  async (req, res, next) => {
    try {
      const submissionId = Number(req.params.id);
      if (Number.isNaN(submissionId)) {
        return res.status(400).json({ message: "Invalid submission id" });
      }
      const result = await issueExemptionAndClose(
        submissionId,
        req.body.resultsNotifiedAt,
        req.user!.id
      );
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/submissions/:id/final-decision",
  requireAnyRole([RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  validate(finalDecisionSchema),
  async (req, res, next) => {
    try {
      const submissionId = Number(req.params.id);
      if (Number.isNaN(submissionId)) {
        return res.status(400).json({ message: "Invalid submission id" });
      }
      const result = await recordFinalDecision(submissionId, req.body, req.user!.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Summarize SLA compliance for a submission
router.get("/submissions/:id/sla-summary", requireUser, requireSubmissionAccess, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid submission id" });
    }
    const result = await getSlaSummary(id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
