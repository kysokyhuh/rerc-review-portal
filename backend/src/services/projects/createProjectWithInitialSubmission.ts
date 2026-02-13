import prisma from "../../config/prismaClient";
import {
  FundingType,
  ProponentCategory,
  ResearchTypePHREB,
  SubmissionType,
} from "../../generated/prisma/client";
import { parseReceivedDate } from "../imports/projectCsvImport";

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
  submissionType?: string | null;
  receivedDate?: string | Date | null;
  fundingType?: string | null;
  notes?: string | null;
  piAffiliation?: string | null;
  collegeOrUnit?: string | null;
  proponentCategory?: string | null;
  department?: string | null;
  proponent?: string | null;
  researchTypePHREB?: string | null;
  researchTypePHREBOther?: string | null;
  // Extra ProtocolProfile fields
  panel?: string | null;
  scientistReviewer?: string | null;
  layReviewer?: string | null;
  independentConsultant?: string | null;
  honorariumStatus?: string | null;
  classificationDate?: string | Date | null;
  finishDate?: string | Date | null;
  status?: string | null;
  monthOfSubmission?: string | null;
  monthOfClearance?: string | null;
}

const normalizeProjectCode = (value: string) => value.trim().toUpperCase();
const normalizeString = (value: unknown) => String(value ?? "").trim();

const parseFundingType = (value?: string | null): FundingType | null => {
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

const parseSubmissionType = (value?: string | null): SubmissionType | null => {
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
  value?: string | null
): ProponentCategory | null => {
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
  value?: string | null
): ResearchTypePHREB | null => {
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

export async function createProjectWithInitialSubmission(
  input: CreateProjectWithInitialSubmissionInput,
  actorId?: number
) {
  const fieldErrors: ProjectCreateFieldError[] = [];

  const projectCode = normalizeProjectCode(input.projectCode || "");
  const title = normalizeString(input.title);
  const piName = normalizeString(input.piName);
  const committeeCode = normalizeString(input.committeeCode || "");

  if (!projectCode) {
    fieldErrors.push({ field: "projectCode", message: "projectCode is required." });
  }
  if (!committeeCode && !input.committeeId) {
    fieldErrors.push({ field: "committeeCode", message: "committeeCode is required." });
  }

  if (fieldErrors.length) {
    throw new ProjectCreateValidationError(fieldErrors);
  }

  const fundingType = parseFundingType(input.fundingType);
  const submissionType = parseSubmissionType(input.submissionType);
  const receivedDate = parseDate(input.receivedDate);

  const existing = await prisma.project.findFirst({
    where: { projectCode },
    select: { id: true },
  });
  if (existing) {
    throw new DuplicateProjectCodeError(projectCode, existing.id);
  }

  let committeeId = input.committeeId;
  if (!committeeId) {
    const committee = await prisma.committee.findFirst({
      where: { code: { equals: committeeCode, mode: "insensitive" } },
      select: { id: true },
    });
    if (!committee) {
      throw new ProjectCreateValidationError([
        { field: "committeeCode", message: "committeeCode does not exist." },
      ]);
    }
    committeeId = committee.id;
  }

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
        initialSubmissionDate: receivedDate,
        createdById: actorId,
      },
      select: { id: true },
    });

    const submission = await tx.submission.create({
      data: {
        projectId: project.id,
        sequenceNumber: 1,
        submissionType,
        receivedDate,
        remarks: notes,
        createdById: actorId,
      },
      select: { id: true },
    });

    const profileFinishDate = input.finishDate
      ? (typeof input.finishDate === 'string' ? new Date(input.finishDate) : input.finishDate)
      : null;
    const profileClassificationDate = input.classificationDate
      ? (typeof input.classificationDate === 'string' ? new Date(input.classificationDate) : input.classificationDate)
      : null;

    await tx.protocolProfile.create({
      data: {
        projectId: project.id,
        title: title || null,
        projectLeader: piName || null,
        college: collegeOrUnit,
        department,
        dateOfSubmission: receivedDate,
        monthOfSubmission:
          normalizeString(input.monthOfSubmission || '') ||
          (receivedDate ? receivedDate.toISOString().slice(0, 7) : null),
        typeOfReview: submissionType ?? null,
        proponent,
        funding: fundingType ?? null,
        typeOfResearchPhreb: researchTypePHREB ?? null,
        typeOfResearchPhrebOther: researchTypePHREBOther,
        status: normalizeString(input.status || '') || null,
        finishDate: profileFinishDate && !Number.isNaN(profileFinishDate.getTime()) ? profileFinishDate : null,
        monthOfClearance: normalizeString(input.monthOfClearance || '') || null,
        remarks: notes,
        panel: normalizeString(input.panel || '') || null,
        scientistReviewer: normalizeString(input.scientistReviewer || '') || null,
        layReviewer: normalizeString(input.layReviewer || '') || null,
        independentConsultant: normalizeString(input.independentConsultant || '') || null,
        honorariumStatus: normalizeString(input.honorariumStatus || '') || null,
      },
    });

    return {
      projectId: project.id,
      submissionId: submission.id,
    };
  });

  return created;
}
