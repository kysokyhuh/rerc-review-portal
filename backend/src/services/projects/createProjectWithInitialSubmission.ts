import prisma from "../../config/prismaClient";
import { FundingType, SubmissionType } from "../../generated/prisma/client";
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
  title: string;
  piName: string;
  committeeCode?: string;
  committeeId?: number;
  submissionType: string;
  receivedDate: string | Date;
  fundingType?: string | null;
  notes?: string | null;
  piAffiliation?: string | null;
  department?: string | null;
  proponent?: string | null;
}

const normalizeProjectCode = (value: string) => value.trim().toUpperCase();
const normalizeString = (value: unknown) => String(value ?? "").trim();

const parseFundingType = (value?: string | null): FundingType => {
  const raw = normalizeString(value);
  if (!raw) return FundingType.NO_FUNDING;
  const normalized = raw.toUpperCase();
  if (normalized in FundingType) {
    return FundingType[normalized as keyof typeof FundingType];
  }
  throw new ProjectCreateValidationError([
    { field: "fundingType", message: "Invalid fundingType." },
  ]);
};

const parseSubmissionType = (value: string): SubmissionType => {
  const normalized = normalizeString(value).toUpperCase().replace(/\s+/g, "_");
  if (normalized && normalized in SubmissionType) {
    return SubmissionType[normalized as keyof typeof SubmissionType];
  }
  throw new ProjectCreateValidationError([
    { field: "submissionType", message: "Invalid submissionType." },
  ]);
};

const parseDate = (value: string | Date): Date => {
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
  if (!title) {
    fieldErrors.push({ field: "title", message: "title is required." });
  }
  if (!piName) {
    fieldErrors.push({ field: "piName", message: "piName is required." });
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
  const department = normalizeString(input.department || "") || null;
  const proponent = normalizeString(input.proponent || "") || null;

  const created = await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        projectCode,
        title,
        piName,
        piAffiliation,
        department,
        proponent,
        fundingType,
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

    return {
      projectId: project.id,
      submissionId: submission.id,
    };
  });

  return created;
}
