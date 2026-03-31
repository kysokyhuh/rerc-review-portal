import { z } from "zod";

const optionalString = (max = 1000) =>
  z.union([z.string().trim().max(max), z.null()]).optional();

const optionalDateLike = z
  .union([z.string().trim().max(50), z.null()])
  .optional();

const completenessStatusEnum = z.enum([
  "COMPLETE",
  "MINOR_MISSING",
  "MAJOR_MISSING",
  "MISSING_SIGNATURES",
  "OTHER",
]);

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
  "RETURNED_FOR_COMPLETION",
  "NOT_ACCEPTED",
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

const reviewerRoleEnum = z.enum([
  "SCIENTIST",
  "LAY",
  "INDEPENDENT_CONSULTANT",
]);

const reminderTargetEnum = z.enum([
  "PROPONENT",
  "REVIEWER",
  "INTERNAL_STAFF",
]);

export const bulkStatusActionEnum = z.enum([
  "START_COMPLETENESS_CHECK",
  "RETURN_FOR_COMPLETION",
  "MARK_NOT_ACCEPTED",
  "ACCEPT_FOR_CLASSIFICATION",
  "MOVE_TO_UNDER_CLASSIFICATION",
  "MARK_CLASSIFIED",
  "START_REVIEW",
]);

const submissionIdsSchema = z
  .array(z.number().int().positive())
  .min(1)
  .max(200)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "submissionIds must be unique",
  });

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

export const startCompletenessCheckSchema = z
  .object({
    completenessStatus: completenessStatusEnum.optional(),
    completenessRemarks: optionalString(2000),
  })
  .strict();

export const screeningOutcomeSchema = z
  .object({
    reason: z.string().trim().min(1).max(2000),
    completenessStatus: completenessStatusEnum.optional(),
    completenessRemarks: optionalString(2000),
  })
  .strict();

export const acceptSubmissionForClassificationSchema = z
  .object({
    projectCode: z.string().trim().min(1).max(64).optional(),
    reason: optionalString(2000),
    completenessRemarks: optionalString(2000),
  })
  .strict();

export const resubmitSubmissionSchema = z
  .object({
    receivedDate: optionalDateLike,
    documentLink: optionalString(1000),
    remarks: optionalString(2000),
  })
  .strict();

export const submissionDocumentSchema = z
  .object({
    type: z.enum([
      "INFORMED_CONSENT",
      "DATA_GATHERING_INSTRUMENT",
      "MATERIAL_TRANSFER_AGREEMENT",
      "PERMISSION_LETTER",
      "OTHER",
    ]),
    title: z.string().trim().min(1).max(255),
    documentUrl: optionalString(1000),
    notes: optionalString(1000),
  })
  .strict();

export const createReviewSchema = z.object({
  reviewerId: z.number().int().positive(),
  isPrimary: z.boolean().optional().default(false),
  reviewerRole: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

export const bulkAssignReviewerSchema = z
  .object({
    submissionIds: submissionIdsSchema,
    reviewerId: z.number().int().positive(),
    reviewerRole: reviewerRoleEnum,
    dueDate: optionalDateLike,
    isPrimary: z.boolean().optional().default(false),
  })
  .strict();

export const bulkStatusActionSchema = z
  .object({
    submissionIds: submissionIdsSchema,
    action: bulkStatusActionEnum,
    reason: optionalString(2000),
    completenessStatus: completenessStatusEnum.optional(),
    completenessRemarks: optionalString(2000),
  })
  .strict();

export const bulkReminderSchema = z
  .object({
    submissionIds: submissionIdsSchema,
    target: reminderTargetEnum,
    note: z.string().trim().min(1).max(2000),
  })
  .strict();

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
  resultsNotifiedAt: z.string().nullable().optional(),
  notes: z.string().trim().min(1).max(2000).optional(),
});

export const issueExemptionSchema = z.object({
  resultsNotifiedAt: z.string().min(1),
});

export const startReviewSchema = z.object({}).strict();
