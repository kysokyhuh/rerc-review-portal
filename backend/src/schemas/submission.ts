import { z } from "zod";

export const classifySubmissionSchema = z.object({
  reviewType: z.enum(["EXEMPT", "EXPEDITED", "FULL_BOARD"]).nullable(),
  classificationDate: z.string().min(1).optional(),
  panelId: z.number().int().positive().nullable().optional(),
  rationale: z.string().nullable().optional(),
});

const submissionTypeEnum = z.enum([
  "INITIAL",
  "RESUBMISSION",
  "AMENDMENT",
  "CONTINUING_REVIEW",
  "FINAL_REPORT",
  "WITHDRAWAL",
  "SAFETY_REPORT",
  "PROTOCOL_DEVIATION",
]);

const submissionStatusEnum = z.enum([
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
]);

const workflowStageEnum = z.enum([
  "AWAITING_CLASSIFICATION",
  "UNDER_CLASSIFICATION",
  "CLASSIFIED",
]);

export const updateSubmissionOverviewSchema = z.object({
  submissionType: submissionTypeEnum.optional(),
  receivedDate: z.string().nullable().optional(),
  finalDecision: z.string().nullable().optional(),
  finalDecisionDate: z.string().nullable().optional(),
  piName: z.string().nullable().optional(),
  committeeId: z.number().int().positive().nullable().optional(),
  changeReason: z.string().nullable().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field is required" },
);

export const updateSubmissionStatusSchema = z.object({
  newStatus: workflowStageEnum,
  reason: z.string().nullable().optional(),
});

export const createReviewSchema = z.object({
  reviewerId: z.number().int().positive(),
  isPrimary: z.boolean().optional().default(false),
  reviewerRole: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

export const reviewDecisionSchema = z.object({
  decision: z.enum([
    "APPROVED",
    "MINOR_REVISIONS",
    "MAJOR_REVISIONS",
    "DISAPPROVED",
    "INFO_ONLY",
  ]),
  remarks: z.string().nullable().optional(),
});

export const finalDecisionSchema = z.object({
  finalDecision: z.enum([
    "APPROVED",
    "MINOR_REVISIONS",
    "MAJOR_REVISIONS",
    "DISAPPROVED",
    "WITHDRAWN",
  ]),
  finalDecisionDate: z.string().nullable().optional(),
  approvalStartDate: z.string().nullable().optional(),
  approvalEndDate: z.string().nullable().optional(),
});

export const issueExemptionSchema = z.object({
  resultsNotifiedAt: z.string().min(1),
});

export const startReviewSchema = z.object({}).strict();
