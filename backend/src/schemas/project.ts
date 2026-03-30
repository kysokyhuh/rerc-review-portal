import { z } from "zod";

const optionalString = (max = 500) =>
  z.union([z.string().trim().max(max), z.null()]).optional();

const optionalIntLike = z
  .union([
    z.number().int(),
    z.string().trim().regex(/^-?\d+$/),
    z.null(),
  ])
  .optional();

const optionalDateLike = z
  .union([z.string().trim().max(50), z.null()])
  .optional();

const optionalBooleanLike = z
  .union([z.boolean(), z.string().trim().max(10), z.null()])
  .optional();

const profileMetaSchema = z
  .object({
    changeReason: z.string().trim().max(500).optional(),
    sourceSubmissionId: z
      .union([z.number().int().positive(), z.string().trim().regex(/^\d+$/)])
      .optional(),
  })
  .strict();

export const createProjectSchema = z
  .object({
    projectCode: z.string().trim().min(1, "projectCode is required.").max(64),
    title: optionalString(500),
    piName: optionalString(255),
    committeeCode: optionalString(50),
    committeeId: z.number().int().positive().optional(),
    submissionType: optionalString(64),
    receivedDate: optionalDateLike,
    fundingType: optionalString(64),
    notes: optionalString(4000),
    piAffiliation: optionalString(255),
    collegeOrUnit: optionalString(255),
    proponentCategory: optionalString(64),
    department: optionalString(255),
    proponent: optionalString(255),
    researchTypePHREB: optionalString(64),
    researchTypePHREBOther: optionalString(255),
  })
  .strict();

export const createPortalIntakeProjectSchema = z
  .object({
    title: z.string().trim().min(1, "title is required.").max(500),
    piName: z.string().trim().min(1, "piName is required.").max(255),
    committeeCode: optionalString(50),
    committeeId: z.number().int().positive().optional(),
    receivedDate: optionalDateLike,
    fundingType: optionalString(64),
    notes: optionalString(4000),
    documentLink: optionalString(1000),
    piAffiliation: optionalString(255),
    collegeOrUnit: optionalString(255),
    proponentCategory: optionalString(64),
    department: optionalString(255),
    proponent: optionalString(255),
    researchTypePHREB: optionalString(64),
    researchTypePHREBOther: optionalString(255),
  })
  .strict();

export const updateProjectProfileSchema = z
  .object({
    _meta: profileMetaSchema.optional(),
    title: optionalString(500),
    projectLeader: optionalString(255),
    college: optionalString(255),
    department: optionalString(255),
    dateOfSubmission: optionalDateLike,
    monthOfSubmission: optionalString(100),
    typeOfReview: optionalString(100),
    proponent: optionalString(255),
    funding: optionalString(100),
    typeOfResearchPhreb: optionalString(100),
    typeOfResearchPhrebOther: optionalString(255),
    status: optionalString(100),
    finishDate: optionalDateLike,
    monthOfClearance: optionalString(100),
    reviewDurationDays: optionalIntLike,
    remarks: optionalString(4000),
    panel: optionalString(255),
    scientistReviewer: optionalString(255),
    layReviewer: optionalString(255),
    independentConsultant: optionalString(255),
    honorariumStatus: optionalString(100),
    classificationOfProposalRerc: optionalString(100),
    totalDays: optionalIntLike,
    submissionCount: optionalIntLike,
    withdrawn: optionalBooleanLike,
    projectEndDate6A: optionalDateLike,
    clearanceExpiration: optionalDateLike,
    progressReportTargetDate: optionalDateLike,
    progressReportSubmission: optionalDateLike,
    progressReportApprovalDate: optionalDateLike,
    progressReportStatus: optionalString(100),
    progressReportDays: optionalIntLike,
    finalReportTargetDate: optionalDateLike,
    finalReportSubmission: optionalDateLike,
    finalReportCompletionDate: optionalDateLike,
    finalReportStatus: optionalString(100),
    finalReportDays: optionalIntLike,
    amendmentSubmission: optionalDateLike,
    amendmentStatusOfRequest: optionalString(100),
    amendmentApprovalDate: optionalDateLike,
    amendmentDays: optionalIntLike,
    continuingSubmission: optionalDateLike,
    continuingStatusOfRequest: optionalString(100),
    continuingApprovalDate: optionalDateLike,
    continuingDays: optionalIntLike,
    primaryReviewer: optionalString(255),
    finalLayReviewer: optionalString(255),
  })
  .strict();

export const createMilestoneSchema = z
  .object({
    label: z.string().trim().min(1, "label is required").max(255),
    orderIndex: optionalIntLike,
    days: optionalIntLike,
    dateOccurred: optionalDateLike,
    ownerRole: optionalString(100),
    notes: optionalString(1000),
  })
  .strict();

export const updateMilestoneSchema = z
  .object({
    label: optionalString(255),
    orderIndex: optionalIntLike,
    days: optionalIntLike,
    dateOccurred: optionalDateLike,
    ownerRole: optionalString(100),
    notes: optionalString(1000),
  })
  .strict();

export const createProjectSubmissionSchema = z
  .object({
    submissionType: z.string().trim().min(1).max(64),
    receivedDate: z.string().trim().min(1).max(50),
    documentLink: optionalString(1000),
    completenessStatus: optionalString(64),
    completenessRemarks: optionalString(2000),
  })
  .strict();

export const createPortalFollowUpSubmissionSchema = z
  .object({
    submissionType: z.string().trim().min(1).max(64),
    receivedDate: optionalDateLike,
    documentLink: optionalString(1000),
    completenessRemarks: optionalString(2000),
  })
  .strict();

export const archiveProjectSchema = z
  .object({
    mode: z.enum(["CLOSED", "WITHDRAWN"]),
    reason: z.string().trim().min(1, "reason is required").max(1000),
  })
  .strict();

export const restoreProjectSchema = z
  .object({
    reason: z.string().trim().min(1, "reason is required").max(1000),
  })
  .strict();
