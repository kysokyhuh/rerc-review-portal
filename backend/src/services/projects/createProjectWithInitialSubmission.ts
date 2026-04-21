import prisma from "../../config/prismaClient";
import {
  FundingType,
  ImportMode,
  ProjectOrigin,
  ProjectStatus,
  ProponentCategory,
  ResearchTypePHREB,
  SLAStage,
  SubmissionStatus,
  SubmissionType,
} from "../../generated/prisma/client";
import {
  type LegacyWorkflowSeedData,
  parseReceivedDate,
  type ProjectProfileReferenceData,
} from "../imports/projectCsvImport";
import {
  buildSlaConfigMap,
  computeDueDate,
  getConfiguredSlaOrDefault,
} from "../sla/submissionSlaService";
import { syncLegacyProfileToWorkflow } from "./legacyImportWorkflow";

export interface ProjectCreateFieldError {
  field: string;
  message: string;
}

export class ProjectCreateValidationError extends Error {
  errors: ProjectCreateFieldError[];

  constructor(errors: ProjectCreateFieldError[]) {
    super("Validation failed");
    this.errors = errors;
  }
}

export class DuplicateProjectCodeError extends Error {
  projectId?: number;

  constructor(projectCode: string, projectId?: number) {
    super(`projectCode already exists: ${projectCode}`);
    this.projectId = projectId;
  }
}

export interface CreateProjectWithInitialSubmissionInput {
  projectCode: string;
  title?: string | null;
  piName?: string | null;
  committeeCode?: string;
  committeeId?: number;
  defaultCommitteeCode?: string | null;
  origin?: ProjectOrigin;
  importMode?: ImportMode;
  importBatchId?: number | null;
  importSourceRowNumber?: number | null;
  submissionType?: string | SubmissionType | null;
  receivedDate?: string | Date | null;
  workflowReceivedDate?: string | Date | null;
  fundingType?: string | FundingType | null;
  notes?: string | null;
  piAffiliation?: string | null;
  collegeOrUnit?: string | null;
  proponentCategory?: string | ProponentCategory | null;
  department?: string | null;
  proponent?: string | null;
  researchTypePHREB?: string | ResearchTypePHREB | null;
  researchTypePHREBOther?: string | null;
  documentLink?: string | null;
  referenceProfile?: ProjectProfileReferenceData | null;
  legacyWorkflowSeed?: LegacyWorkflowSeedData | null;
}

const normalizeProjectCode = (value: string) => value.trim().toUpperCase();
const normalizeString = (value: unknown) => String(value ?? "").trim();
const toMonthLabel = (value: Date) =>
  value.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

const parseFundingType = (value?: string | FundingType | null): FundingType | null => {
  if (!value) return null;
  if (typeof value !== "string") {
    return value;
  }
  const raw = normalizeString(value);
  if (!raw || raw.toUpperCase() === "N/A") return null;
  const normalized = raw.toUpperCase();
  if (normalized in FundingType) {
    return FundingType[normalized as keyof typeof FundingType];
  }
  const compact = normalized.replace(/[^A-Z]/g, "");
  if (compact.includes("SELF")) return FundingType.SELF_FUNDED;
  if (compact.includes("NOFUND") || compact === "NONE") return FundingType.NO_FUNDING;
  if (compact.includes("INTERNAL") || compact.includes("RGMO")) return FundingType.INTERNAL;
  if (compact.includes("EXTERNAL")) return FundingType.EXTERNAL;
  if (compact.includes("GOVERNMENT") || compact.includes("GRANT")) return FundingType.EXTERNAL;
  if (compact === "OTHERS" || compact === "OTHER") return FundingType.EXTERNAL;
  return null;
};

const parseSubmissionType = (
  value?: string | SubmissionType | null
): SubmissionType | null => {
  if (!value) return null;
  if (typeof value !== "string") {
    return value;
  }
  const normalized = normalizeString(value).toUpperCase().replace(/\s+/g, "_");
  if (!normalized) return null;
  if (normalized in SubmissionType) {
    return SubmissionType[normalized as keyof typeof SubmissionType];
  }
  throw new ProjectCreateValidationError([
    { field: "submissionType", message: "Invalid submissionType." },
  ]);
};

const parseProponentCategory = (
  value?: string | ProponentCategory | null
): ProponentCategory | null => {
  if (!value) return null;
  if (typeof value !== "string") {
    return value;
  }
  const raw = normalizeString(value);
  if (!raw) return null;
  const normalized = raw.toUpperCase().replace(/\s+/g, "_");
  if (normalized in ProponentCategory) {
    return ProponentCategory[normalized as keyof typeof ProponentCategory];
  }
  throw new ProjectCreateValidationError([
    { field: "proponentCategory", message: "Invalid proponentCategory." },
  ]);
};

const parseResearchTypePHREB = (
  value?: string | ResearchTypePHREB | null
): ResearchTypePHREB | null => {
  if (!value) return null;
  if (typeof value !== "string") {
    return value;
  }
  const raw = normalizeString(value);
  if (!raw) return null;
  const normalized = raw.toUpperCase().replace(/\s+/g, "_");
  if (normalized in ResearchTypePHREB) {
    return ResearchTypePHREB[normalized as keyof typeof ResearchTypePHREB];
  }
  throw new ProjectCreateValidationError([
    { field: "researchTypePHREB", message: "Invalid research type." },
  ]);
};

const parseDate = (value?: string | Date | null): Date | null => {
  if (value == null) return null;
  if (typeof value === "string" && !value.trim()) return null;
  if (value instanceof Date) {
    if (!Number.isNaN(value.getTime())) return value;
    throw new ProjectCreateValidationError([
      { field: "receivedDate", message: "Invalid receivedDate." },
    ]);
  }
  const parsed = parseReceivedDate(String(value));
  if (!parsed) {
    throw new ProjectCreateValidationError([
      { field: "receivedDate", message: "Invalid receivedDate." },
    ]);
  }
  return parsed;
};

const resolveCommitteeId = async (
  committeeCode: string,
  committeeId?: number,
  options?: {
    allowFirstActiveFallback?: boolean;
    defaultCommitteeCode?: string | null;
  }
) => {
  if (committeeId) {
    return committeeId;
  }

  const allowFirstActiveFallback = options?.allowFirstActiveFallback ?? true;
  const fallbackCommitteeCode = normalizeString(options?.defaultCommitteeCode || "");
  const resolvedCommitteeCode = committeeCode || fallbackCommitteeCode;

  const committee = await prisma.committee.findFirst({
    where: resolvedCommitteeCode
      ? { code: { equals: resolvedCommitteeCode, mode: "insensitive" } }
      : allowFirstActiveFallback
        ? { isActive: true }
        : undefined,
    orderBy: { id: "asc" },
    select: { id: true },
  });
  if (!committee) {
    throw new ProjectCreateValidationError([
      {
        field: "committeeCode",
        message: resolvedCommitteeCode
          ? "committeeCode does not exist."
          : allowFirstActiveFallback
            ? "No active committee found."
            : "Blank committeeCode requires a configured default intake committee.",
      },
    ]);
  }

  return committee.id;
};

export async function createProjectWithInitialSubmission(
  input: CreateProjectWithInitialSubmissionInput,
  actorId: number
) {
  const fieldErrors: ProjectCreateFieldError[] = [];

  const projectCode = normalizeProjectCode(input.projectCode || "");
  const title = normalizeString(input.title);
  const piName = normalizeString(input.piName);
  const committeeCode = normalizeString(input.committeeCode || "");
  const importMode = input.importMode ?? ImportMode.INTAKE_IMPORT;
  const origin =
    input.origin ??
    (importMode === ImportMode.LEGACY_MIGRATION
      ? ProjectOrigin.LEGACY_IMPORT
      : ProjectOrigin.NATIVE_PORTAL);
  const hasLegacyWorkflowSeed = Boolean(input.legacyWorkflowSeed);
  const isImportedUpload = Boolean(input.importBatchId);

  if (!projectCode) {
    fieldErrors.push({ field: "projectCode", message: "projectCode is required." });
  }
  if (hasLegacyWorkflowSeed && !input.importBatchId) {
    fieldErrors.push({
      field: "importBatchId",
      message: "importBatchId is required for legacy imports.",
    });
  }
  if (fieldErrors.length) {
    throw new ProjectCreateValidationError(fieldErrors);
  }

  const fundingType = parseFundingType(input.fundingType);
  const submissionType = parseSubmissionType(input.submissionType);
  const referenceReceivedDate = parseDate(input.receivedDate);
  const workflowReceivedDate =
    parseDate(input.workflowReceivedDate) ?? referenceReceivedDate;

  const existing = await prisma.project.findFirst({
    where: { projectCode },
    select: { id: true },
  });
  if (existing) {
    throw new DuplicateProjectCodeError(projectCode, existing.id);
  }

  const committeeId = await resolveCommitteeId(committeeCode, input.committeeId, {
    allowFirstActiveFallback: false,
    defaultCommitteeCode: input.defaultCommitteeCode,
  });

  const notes = normalizeString(input.notes || "") || null;
  const piAffiliation = normalizeString(input.piAffiliation || "") || null;
  const collegeOrUnit =
    normalizeString(input.collegeOrUnit || "") || piAffiliation || null;
  const proponentCategory = parseProponentCategory(input.proponentCategory);
  const department = normalizeString(input.department || "") || null;
  const proponent = normalizeString(input.proponent || "") || null;
  const researchTypePHREB = parseResearchTypePHREB(input.researchTypePHREB);
  const researchTypePHREBOther =
    normalizeString(input.researchTypePHREBOther || "") || null;

  const classificationDueDate = await (async () => {
        const [slaConfigs, holidayRows] = await Promise.all([
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
        const classificationConfig = getConfiguredSlaOrDefault(
          buildSlaConfigMap(slaConfigs),
          committeeId,
          SLAStage.CLASSIFICATION,
          null
        );
        return workflowReceivedDate && classificationConfig
          ? computeDueDate(
              classificationConfig.dayMode,
              workflowReceivedDate,
              classificationConfig.targetDays,
              holidayRows.map((row) => row.date)
            )
          : null;
      })();

  const referenceProfile = input.referenceProfile;
  const legacyWorkflowSeed = hasLegacyWorkflowSeed ? input.legacyWorkflowSeed ?? null : null;
  const submissionStatus = SubmissionStatus.AWAITING_CLASSIFICATION;
  const submissionHistoryReason = isImportedUpload
    ? "Imported through CSV upload and entered the live workflow."
    : "Created through staff-assisted intake";
  const profileSubmissionMonth =
    referenceProfile?.monthOfSubmission ??
    (referenceReceivedDate ? toMonthLabel(referenceReceivedDate) : null);

  const created = await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        projectCode,
        title: title || null,
        piName: piName || null,
        piAffiliation,
        collegeOrUnit,
        proponentCategory,
        department,
        proponent,
        fundingType,
        researchTypePHREB,
        researchTypePHREBOther,
        committeeId: committeeId!,
        initialSubmissionDate: workflowReceivedDate,
        createdById: actorId,
        origin,
        importBatchId: input.importBatchId ?? null,
        importSourceRowNumber: input.importSourceRowNumber ?? null,
      },
      select: { id: true },
    });

    const submission = await tx.submission.create({
      data: {
        projectId: project.id,
        sequenceNumber: 1,
        submissionType,
        status: submissionStatus,
        receivedDate: workflowReceivedDate,
        classificationDueDate,
        documentLink: normalizeString(input.documentLink || "") || null,
        remarks: notes,
        createdById: actorId,
      },
      select: { id: true },
    });

    await tx.submissionStatusHistory.create({
      data: {
        submissionId: submission.id,
        oldStatus: null,
        newStatus: submissionStatus,
        reason: submissionHistoryReason,
        changedById: actorId,
      },
    });

    await tx.protocolProfile.create({
      data: {
        projectId: project.id,
        title: referenceProfile?.title ?? (title || null),
        projectLeader: referenceProfile?.projectLeader ?? (piName || null),
        college: referenceProfile?.college ?? collegeOrUnit,
        department: referenceProfile?.department ?? department,
        dateOfSubmission:
          referenceProfile?.dateOfSubmission ?? referenceReceivedDate ?? workflowReceivedDate,
        monthOfSubmission: profileSubmissionMonth,
        typeOfReview: referenceProfile?.typeOfReview ?? submissionType ?? null,
        proponent: referenceProfile?.proponent ?? proponent,
        funding: referenceProfile?.funding ?? (fundingType ?? null),
        typeOfResearchPhreb:
          referenceProfile?.typeOfResearchPhreb ?? (researchTypePHREB ?? null),
        typeOfResearchPhrebOther:
          referenceProfile?.typeOfResearchPhrebOther ?? researchTypePHREBOther,
        remarks: referenceProfile?.remarks ?? notes,
      },
    });

    if (legacyWorkflowSeed) {
      await syncLegacyProfileToWorkflow(tx, {
        projectId: project.id,
        committeeId,
        projectStatus: ProjectStatus.DRAFT,
        sourceSubmissionId: submission.id,
        changedById: actorId,
        data: {
          status: legacyWorkflowSeed.importedStatus ?? null,
          typeOfReview:
            referenceProfile?.typeOfReview ??
            legacyWorkflowSeed.importedTypeOfReview ??
            null,
          classificationOfProposalRerc:
            legacyWorkflowSeed.importedClassificationOfProposal ?? null,
          withdrawn: legacyWorkflowSeed.importedWithdrawn ?? null,
          finishDate:
            legacyWorkflowSeed.importedFinishDate ??
            legacyWorkflowSeed.importedFinalReportCompletionDate ??
            null,
          classificationDate:
            legacyWorkflowSeed.importedClassificationDate ?? null,
          dateOfSubmission:
            referenceProfile?.dateOfSubmission ??
            referenceReceivedDate ??
            workflowReceivedDate,
          panel:
            legacyWorkflowSeed.importedPanel ??
            null,
          primaryReviewer:
            legacyWorkflowSeed.importedPrimaryReviewer ?? null,
          scientistReviewer:
            legacyWorkflowSeed.importedScientistReviewer ?? null,
          layReviewer:
            legacyWorkflowSeed.importedLayReviewer ?? null,
          finalLayReviewer:
            legacyWorkflowSeed.importedFinalLayReviewer ?? null,
          independentConsultant:
            legacyWorkflowSeed.importedIndependentConsultant ?? null,
          clearanceExpiration:
            legacyWorkflowSeed.importedClearanceExpiration ?? null,
          projectEndDate6A:
            legacyWorkflowSeed.importedProjectEndDate6A ?? null,
          progressReportTargetDate:
            legacyWorkflowSeed.importedProgressReportTargetDate ?? null,
          progressReportSubmission:
            legacyWorkflowSeed.importedProgressReportSubmission ?? null,
          progressReportApprovalDate:
            legacyWorkflowSeed.importedProgressReportApprovalDate ?? null,
          progressReportStatus:
            legacyWorkflowSeed.importedProgressReportStatus ?? null,
          progressReportDays:
            legacyWorkflowSeed.importedProgressReportDays ?? null,
          finalReportTargetDate:
            legacyWorkflowSeed.importedFinalReportTargetDate ?? null,
          finalReportSubmission:
            legacyWorkflowSeed.importedFinalReportSubmission ?? null,
          finalReportCompletionDate:
            legacyWorkflowSeed.importedFinalReportCompletionDate ?? null,
          finalReportStatus:
            legacyWorkflowSeed.importedFinalReportStatus ?? null,
          finalReportDays:
            legacyWorkflowSeed.importedFinalReportDays ?? null,
          amendmentSubmission:
            legacyWorkflowSeed.importedAmendmentSubmission ?? null,
          amendmentStatus:
            legacyWorkflowSeed.importedAmendmentStatus ?? null,
          amendmentApprovalDate:
            legacyWorkflowSeed.importedAmendmentApprovalDate ?? null,
          amendmentDays:
            legacyWorkflowSeed.importedAmendmentDays ?? null,
          continuingSubmission:
            legacyWorkflowSeed.importedContinuingSubmission ?? null,
          continuingStatus:
            legacyWorkflowSeed.importedContinuingStatus ?? null,
          continuingApprovalDate:
            legacyWorkflowSeed.importedContinuingApprovalDate ?? null,
          continuingDays:
            legacyWorkflowSeed.importedContinuingDays ?? null,
          remarks:
            legacyWorkflowSeed.importedRemarks ?? referenceProfile?.remarks ?? notes,
          rawRowJson: legacyWorkflowSeed.rawRowJson,
        },
      });
    }

    return {
      projectId: project.id,
      submissionId: submission.id,
    };
  });

  return created;
}

export interface CreatePortalInitialSubmissionInput {
  title: string;
  piName: string;
  committeeCode?: string;
  committeeId?: number;
  receivedDate?: string | Date | null;
  fundingType?: string | null;
  notes?: string | null;
  documentLink?: string | null;
  piAffiliation?: string | null;
  collegeOrUnit?: string | null;
  proponentCategory?: string | null;
  department?: string | null;
  proponent?: string | null;
  researchTypePHREB?: string | null;
  researchTypePHREBOther?: string | null;
}

export async function createPortalInitialSubmission(
  input: CreatePortalInitialSubmissionInput,
  actorId: number
) {
  const title = normalizeString(input.title);
  const piName = normalizeString(input.piName);
  const committeeCode = normalizeString(input.committeeCode || "");

  const fieldErrors: ProjectCreateFieldError[] = [];
  if (!title) {
    fieldErrors.push({ field: "title", message: "title is required." });
  }
  if (!piName) {
    fieldErrors.push({ field: "piName", message: "piName is required." });
  }
  if (fieldErrors.length) {
    throw new ProjectCreateValidationError(fieldErrors);
  }

  const committeeId = await resolveCommitteeId(committeeCode, input.committeeId);
  const receivedDate = parseDate(input.receivedDate) ?? new Date();
  const fundingType = parseFundingType(input.fundingType);
  const notes = normalizeString(input.notes || "") || null;
  const documentLink = normalizeString(input.documentLink || "") || null;
  const piAffiliation = normalizeString(input.piAffiliation || "") || null;
  const collegeOrUnit =
    normalizeString(input.collegeOrUnit || "") || piAffiliation || null;
  const proponentCategory = parseProponentCategory(input.proponentCategory);
  const department = normalizeString(input.department || "") || null;
  const proponent = normalizeString(input.proponent || "") || null;
  const researchTypePHREB = parseResearchTypePHREB(input.researchTypePHREB);
  const researchTypePHREBOther =
    normalizeString(input.researchTypePHREBOther || "") || null;

  const created = await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        projectCode: null,
        title,
        piName,
        piAffiliation,
        collegeOrUnit,
        proponentCategory,
        department,
        proponent,
        fundingType,
        researchTypePHREB,
        researchTypePHREBOther,
        committeeId,
        initialSubmissionDate: receivedDate,
        createdById: actorId,
      },
      select: { id: true },
    });

    const submission = await tx.submission.create({
      data: {
        projectId: project.id,
        sequenceNumber: 1,
        submissionType: SubmissionType.INITIAL,
        status: SubmissionStatus.RECEIVED,
        receivedDate,
        documentLink,
        remarks: notes,
        createdById: actorId,
      },
      select: { id: true },
    });

    await tx.submissionStatusHistory.create({
      data: {
        submissionId: submission.id,
        oldStatus: null,
        newStatus: SubmissionStatus.RECEIVED,
        reason: "Initial submission received via portal intake",
        changedById: actorId,
      },
    });

    await tx.protocolProfile.create({
      data: {
        projectId: project.id,
        title,
        projectLeader: piName,
        college: collegeOrUnit,
        department,
        dateOfSubmission: receivedDate,
        monthOfSubmission: toMonthLabel(receivedDate),
        typeOfReview: SubmissionType.INITIAL,
        proponent,
        funding: fundingType ?? null,
        typeOfResearchPhreb: researchTypePHREB ?? null,
        typeOfResearchPhrebOther: researchTypePHREBOther,
        status: SubmissionStatus.RECEIVED,
        remarks: notes,
      },
    });

    return {
      projectId: project.id,
      submissionId: submission.id,
    };
  });

  return created;
}
