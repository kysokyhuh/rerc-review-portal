/**
 * Project service — business logic extracted from projectRoutes.
 */
import prisma from "../../config/prismaClient";
import { AppError } from "../../middleware/errorHandler";
import {
  ProjectStatus,
  SubmissionStatus,
  type SubmissionType,
  type CompletenessStatus,
} from "../../generated/prisma/client";

/* ------------------------------------------------------------------ */
/*  Helpers (moved from routes)                                        */
/* ------------------------------------------------------------------ */
export const asNullableString = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
};

export const asNullableInt = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
};

export const asNullableBoolean = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return null;
};

export const asNullableDate = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const ARCHIVED_PROJECT_STATUSES = [ProjectStatus.CLOSED, ProjectStatus.WITHDRAWN] as const;

const normalizeArchiveProjectStatus = (value?: string | null) => {
  if (value === ProjectStatus.CLOSED || value === ProjectStatus.WITHDRAWN) {
    return value;
  }
  return null;
};

const compareNullableDates = (
  left: Date | string | null | undefined,
  right: Date | string | null | undefined,
  dir: "asc" | "desc"
) => {
  const leftTime = left ? new Date(left).getTime() : Number.NEGATIVE_INFINITY;
  const rightTime = right ? new Date(right).getTime() : Number.NEGATIVE_INFINITY;
  return dir === "asc" ? leftTime - rightTime : rightTime - leftTime;
};

/* ------------------------------------------------------------------ */
/*  List projects                                                      */
/* ------------------------------------------------------------------ */
export async function listProjects() {
  return prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: { committee: true, createdBy: true },
  });
}

/* ------------------------------------------------------------------ */
/*  Search projects                                                    */
/* ------------------------------------------------------------------ */
export async function searchProjects(
  query: string,
  limit: number,
  committeeCode: string | null
) {
  if (!query) return { items: [] };

  const tokens = query.split(/\s+/).filter(Boolean);

  const titleHistory = await prisma.projectChangeLog.findMany({
    where: {
      fieldName: "title",
      OR: [
        { oldValue: { contains: query, mode: "insensitive" } },
        { newValue: { contains: query, mode: "insensitive" } },
      ],
    },
    select: { projectId: true },
    take: 25,
  });
  const titleHistoryIds = titleHistory.map((row) => row.projectId);

  const projects = await prisma.project.findMany({
    where: {
      ...(committeeCode ? { committee: { code: committeeCode } } : {}),
      OR: [
        { projectCode: { contains: query, mode: "insensitive" } },
        { title: { contains: query, mode: "insensitive" } },
        { piName: { contains: query, mode: "insensitive" } },
        { piSurname: { contains: query, mode: "insensitive" } },
        ...(tokens.length > 0 ? [{ keywords: { hasSome: tokens } }] : []),
        ...(titleHistoryIds.length > 0 ? [{ id: { in: titleHistoryIds } }] : []),
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true, projectCode: true, title: true, piName: true, updatedAt: true,
    },
  });

  return { items: projects };
}

/* ------------------------------------------------------------------ */
/*  Archived projects                                                  */
/* ------------------------------------------------------------------ */
export async function getArchivedProjects(params: {
  committeeCode?: string | null;
  limit: number;
  offset: number;
  search?: string | null;
  statusFilter?: string | null;
  reviewTypeFilter?: string | null;
  collegeFilter?: string | null;
  sortBy?: "lastModified" | "submitted";
  sortDir?: "asc" | "desc";
}) {
  const {
    committeeCode,
    limit,
    offset,
    search,
    statusFilter,
    reviewTypeFilter,
    collegeFilter,
    sortBy = "lastModified",
    sortDir = "desc",
  } = params;
  const archiveStatuses = normalizeArchiveProjectStatus(statusFilter)
    ? [normalizeArchiveProjectStatus(statusFilter)!]
    : [...ARCHIVED_PROJECT_STATUSES];

  const whereClause: any = {
    overallStatus: { in: archiveStatuses },
    origin: { not: "LEGACY_IMPORT" as const },
  };

  if (committeeCode) whereClause.committee = { code: committeeCode };
  if (collegeFilter) whereClause.piAffiliation = { equals: collegeFilter, mode: "insensitive" };
  if (search) {
    whereClause.OR = [
      { projectCode: { contains: search, mode: "insensitive" } },
      { title: { contains: search, mode: "insensitive" } },
      { piName: { contains: search, mode: "insensitive" } },
    ];
  }

  const projects = await prisma.project.findMany({
    where: whereClause,
    include: {
      submissions: {
        orderBy: [{ sequenceNumber: "desc" }, { id: "desc" }],
        take: 1,
        include: { classification: { select: { reviewType: true } } },
      },
      committee: { select: { code: true, name: true } },
      statusHistory: {
        where: { newStatus: { in: ARCHIVED_PROJECT_STATUSES as unknown as ProjectStatus[] } },
        orderBy: [{ effectiveDate: "desc" }, { id: "desc" }],
        take: 1,
      },
    },
  });

  const archivedProjects = projects.filter((project) => {
    const latestSubmission = project.submissions[0];
    if (!latestSubmission) return false;
    if (reviewTypeFilter && latestSubmission.classification?.reviewType !== reviewTypeFilter) {
      return false;
    }
    return (
      project.overallStatus === ProjectStatus.CLOSED ||
      project.overallStatus === ProjectStatus.WITHDRAWN
    ) && archiveStatuses.includes(project.overallStatus as (typeof ARCHIVED_PROJECT_STATUSES)[number]);
  });

  archivedProjects.sort((left, right) => {
    if (sortBy === "submitted") {
      const leftReceived = left.submissions[0]?.receivedDate ?? left.initialSubmissionDate;
      const rightReceived = right.submissions[0]?.receivedDate ?? right.initialSubmissionDate;
      return compareNullableDates(leftReceived, rightReceived, sortDir);
    }
    return compareNullableDates(left.updatedAt, right.updatedAt, sortDir);
  });

  const items = archivedProjects.slice(offset, offset + limit).map((project) => {
    const latestSubmission = project.submissions[0];
    const archiveEvent = project.statusHistory[0];
    return {
      projectId: project.id,
      projectCode: project.projectCode,
      title: project.title,
      piName: project.piName,
      latestSubmissionId: latestSubmission?.id ?? null,
      latestSubmissionStatus: latestSubmission?.status ?? null,
      receivedDate: latestSubmission?.receivedDate ?? project.initialSubmissionDate,
      reviewType: latestSubmission?.classification?.reviewType ?? null,
      committeeCode: project.committee?.code ?? null,
      overallStatus: project.overallStatus,
      archiveDate: archiveEvent?.effectiveDate ?? null,
      archiveReason: archiveEvent?.reason ?? null,
    };
  });

  return { items, total: archivedProjects.length, limit, offset };
}

/* ------------------------------------------------------------------ */
/*  Get project by ID                                                  */
/* ------------------------------------------------------------------ */
export async function getProjectById(id: number) {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      committee: true,
      createdBy: true,
      legacyImportSnapshot: {
        include: {
          importBatch: {
            select: {
              id: true,
              mode: true,
              sourceFilename: true,
              createdAt: true,
            },
          },
        },
      },
      submissions: { orderBy: { sequenceNumber: "asc" } },
    },
  });
  if (!project) throw new AppError(404, "NOT_FOUND", "Project not found");
  return project;
}

/* ------------------------------------------------------------------ */
/*  Get full project lifecycle                                         */
/* ------------------------------------------------------------------ */
export async function getProjectFull(id: number) {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      committee: true,
      createdBy: true,
      protocolProfile: true,
      legacyImportSnapshot: {
        include: {
          importBatch: {
            select: {
              id: true,
              mode: true,
              sourceFilename: true,
              createdAt: true,
            },
          },
        },
      },
      protocolMilestones: { orderBy: [{ orderIndex: "asc" }, { id: "asc" }] },
      changeLog: {
        orderBy: { createdAt: "desc" },
        include: { changedBy: true },
      },
      statusHistory: {
        orderBy: [{ effectiveDate: "desc" }, { id: "desc" }],
        include: { changedBy: true },
      },
      submissions: {
        orderBy: [{ receivedDate: "asc" }, { id: "asc" }],
        include: {
          classification: true,
          reviews: { include: { reviewer: true } },
          statusHistory: {
            orderBy: { effectiveDate: "asc" },
            include: { changedBy: true },
          },
        },
      },
    },
  });
  if (!project) throw new AppError(404, "NOT_FOUND", "Project not found");
  return project;
}

export async function archiveProject(
  projectId: number,
  mode: "CLOSED" | "WITHDRAWN",
  reason: string,
  actorId: number
) {
  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new AppError(400, "REASON_REQUIRED", "Archive reason is required");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      overallStatus: true,
      submissions: {
        orderBy: [{ sequenceNumber: "desc" }, { id: "desc" }],
        take: 1,
        select: { id: true, status: true },
      },
    },
  });

  if (!project) {
    throw new AppError(404, "NOT_FOUND", "Project not found");
  }

  if (ARCHIVED_PROJECT_STATUSES.includes(project.overallStatus as (typeof ARCHIVED_PROJECT_STATUSES)[number])) {
    throw new AppError(409, "ALREADY_ARCHIVED", "Project is already archived");
  }

  const latestSubmission = project.submissions[0];
  if (!latestSubmission) {
    throw new AppError(400, "NO_SUBMISSIONS", "Project must have a submission before it can be archived");
  }

  if (mode === ProjectStatus.CLOSED && latestSubmission.status !== SubmissionStatus.CLOSED) {
    throw new AppError(400, "ARCHIVE_NOT_ALLOWED", "Latest submission must be closed before archiving as completed");
  }

  if (mode === ProjectStatus.WITHDRAWN && latestSubmission.status !== SubmissionStatus.WITHDRAWN) {
    throw new AppError(400, "ARCHIVE_NOT_ALLOWED", "Latest submission must be withdrawn before archiving as withdrawn");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const history = await tx.projectStatusHistory.create({
      data: {
        projectId,
        oldStatus: project.overallStatus,
        newStatus: mode as ProjectStatus,
        reason: trimmedReason,
        changedById: actorId,
      },
      include: {
        changedBy: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    });

    const nextProject = await tx.project.update({
      where: { id: projectId },
      data: { overallStatus: mode as ProjectStatus },
      select: {
        id: true,
        overallStatus: true,
      },
    });

    return { project: nextProject, history };
  });

  return updated;
}

export async function restoreProjectArchive(
  projectId: number,
  reason: string,
  actorId: number
) {
  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new AppError(400, "REASON_REQUIRED", "Restore reason is required");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      overallStatus: true,
    },
  });

  if (!project) {
    throw new AppError(404, "NOT_FOUND", "Project not found");
  }

  if (!ARCHIVED_PROJECT_STATUSES.includes(project.overallStatus as (typeof ARCHIVED_PROJECT_STATUSES)[number])) {
    throw new AppError(400, "NOT_ARCHIVED", "Project is not currently archived");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const history = await tx.projectStatusHistory.create({
      data: {
        projectId,
        oldStatus: project.overallStatus,
        newStatus: ProjectStatus.ACTIVE,
        reason: trimmedReason,
        changedById: actorId,
      },
      include: {
        changedBy: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    });

    const nextProject = await tx.project.update({
      where: { id: projectId },
      data: { overallStatus: ProjectStatus.ACTIVE },
      select: {
        id: true,
        overallStatus: true,
      },
    });

    return { project: nextProject, history };
  });

  return updated;
}

/* ------------------------------------------------------------------ */
/*  Get profile + milestones                                           */
/* ------------------------------------------------------------------ */
export async function getProjectProfile(projectId: number) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      origin: true,
      protocolProfile: true,
      legacyImportSnapshot: {
        include: {
          importBatch: {
            select: {
              id: true,
              mode: true,
              sourceFilename: true,
              createdAt: true,
            },
          },
        },
      },
      protocolMilestones: { orderBy: [{ orderIndex: "asc" }, { id: "asc" }] },
    },
  });
  if (!project) throw new AppError(404, "NOT_FOUND", "Project not found");
  return {
    origin: project.origin,
    profile: project.protocolProfile,
    legacyImportSnapshot: project.legacyImportSnapshot,
    milestones: project.protocolMilestones,
  };
}

/* ------------------------------------------------------------------ */
/*  Upsert profile                                                     */
/* ------------------------------------------------------------------ */
export async function upsertProjectProfile(
  projectId: number,
  payload: Record<string, any>,
  userId: number
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId }, select: { id: true },
  });
  if (!project) throw new AppError(404, "NOT_FOUND", "Project not found");

  const changeReason = asNullableString(payload._meta?.changeReason);
  const sourceSubmissionId = payload._meta?.sourceSubmissionId
    ? Number(payload._meta.sourceSubmissionId) : null;
  const changedById = userId;

  const data = {
    title: asNullableString(payload.title),
    projectLeader: asNullableString(payload.projectLeader),
    college: asNullableString(payload.college),
    department: asNullableString(payload.department),
    dateOfSubmission: asNullableDate(payload.dateOfSubmission),
    monthOfSubmission: asNullableString(payload.monthOfSubmission),
    typeOfReview: asNullableString(payload.typeOfReview),
    proponent: asNullableString(payload.proponent),
    funding: asNullableString(payload.funding),
    typeOfResearchPhreb: asNullableString(payload.typeOfResearchPhreb),
    typeOfResearchPhrebOther: asNullableString(payload.typeOfResearchPhrebOther),
    status: asNullableString(payload.status),
    finishDate: asNullableDate(payload.finishDate),
    monthOfClearance: asNullableString(payload.monthOfClearance),
    reviewDurationDays: asNullableInt(payload.reviewDurationDays),
    remarks: asNullableString(payload.remarks),
    panel: asNullableString(payload.panel),
    scientistReviewer: asNullableString(payload.scientistReviewer),
    layReviewer: asNullableString(payload.layReviewer),
    independentConsultant: asNullableString(payload.independentConsultant),
    honorariumStatus: asNullableString(payload.honorariumStatus),
    classificationOfProposalRerc: asNullableString(payload.classificationOfProposalRerc),
    totalDays: asNullableInt(payload.totalDays),
    submissionCount: asNullableInt(payload.submissionCount),
    withdrawn: asNullableBoolean(payload.withdrawn),
    projectEndDate6A: asNullableDate(payload.projectEndDate6A),
    clearanceExpiration: asNullableDate(payload.clearanceExpiration),
    progressReportTargetDate: asNullableDate(payload.progressReportTargetDate),
    progressReportSubmission: asNullableDate(payload.progressReportSubmission),
    progressReportApprovalDate: asNullableDate(payload.progressReportApprovalDate),
    progressReportStatus: asNullableString(payload.progressReportStatus),
    progressReportDays: asNullableInt(payload.progressReportDays),
    finalReportTargetDate: asNullableDate(payload.finalReportTargetDate),
    finalReportSubmission: asNullableDate(payload.finalReportSubmission),
    finalReportCompletionDate: asNullableDate(payload.finalReportCompletionDate),
    finalReportStatus: asNullableString(payload.finalReportStatus),
    finalReportDays: asNullableInt(payload.finalReportDays),
    amendmentSubmission: asNullableDate(payload.amendmentSubmission),
    amendmentStatusOfRequest: asNullableString(payload.amendmentStatusOfRequest),
    amendmentApprovalDate: asNullableDate(payload.amendmentApprovalDate),
    amendmentDays: asNullableInt(payload.amendmentDays),
    continuingSubmission: asNullableDate(payload.continuingSubmission),
    continuingStatusOfRequest: asNullableString(payload.continuingStatusOfRequest),
    continuingApprovalDate: asNullableDate(payload.continuingApprovalDate),
    continuingDays: asNullableInt(payload.continuingDays),
    primaryReviewer: asNullableString(payload.primaryReviewer),
    finalLayReviewer: asNullableString(payload.finalLayReviewer),
  };

  const existing = await prisma.protocolProfile.findUnique({ where: { projectId } });

  const changeLogs: Array<{
    projectId: number; fieldName: string;
    oldValue: string | null; newValue: string | null;
    reason: string | null; sourceSubmissionId: number | null;
    changedById: number | null;
  }> = [];

  const serializeValue = (val: unknown): string | null => {
    if (val === null || val === undefined) return null;
    if (val instanceof Date) return val.toISOString();
    return String(val);
  };

  for (const [fieldName, newVal] of Object.entries(data)) {
    const oldRaw = existing ? (existing as Record<string, unknown>)[fieldName] : undefined;
    const oldSerialized = serializeValue(oldRaw);
    const newSerialized = serializeValue(newVal);
    if (oldSerialized !== newSerialized) {
      changeLogs.push({
        projectId, fieldName,
        oldValue: oldSerialized, newValue: newSerialized,
        reason: changeReason,
        sourceSubmissionId: sourceSubmissionId && Number.isFinite(sourceSubmissionId)
          ? sourceSubmissionId : null,
        changedById,
      });
    }
  }

  return prisma.$transaction(async (tx) => {
    const upserted = await tx.protocolProfile.upsert({
      where: { projectId },
      update: data,
      create: { projectId, ...data },
    });
    if (changeLogs.length > 0) {
      await tx.projectChangeLog.createMany({ data: changeLogs });
    }
    return upserted;
  });
}

/* ------------------------------------------------------------------ */
/*  Milestones CRUD                                                    */
/* ------------------------------------------------------------------ */
export async function createMilestone(projectId: number, body: Record<string, any>) {
  const label = asNullableString(body?.label);
  if (!label) throw new AppError(400, "VALIDATION_ERROR", "label is required");

  return prisma.protocolMilestone.create({
    data: {
      projectId,
      label,
      orderIndex: asNullableInt(body?.orderIndex) ?? 0,
      days: asNullableInt(body?.days),
      dateOccurred: asNullableDate(body?.dateOccurred),
      ownerRole: asNullableString(body?.ownerRole),
      notes: asNullableString(body?.notes),
    },
  });
}

export async function updateMilestone(
  projectId: number,
  milestoneId: number,
  body: Record<string, any>
) {
  const existing = await prisma.protocolMilestone.findUnique({
    where: { id: milestoneId },
    select: { id: true, projectId: true },
  });
  if (!existing || existing.projectId !== projectId) {
    throw new AppError(404, "NOT_FOUND", "Milestone not found");
  }

  return prisma.protocolMilestone.update({
    where: { id: milestoneId },
    data: {
      label: asNullableString(body?.label) ?? undefined,
      orderIndex: asNullableInt(body?.orderIndex) ?? undefined,
      days: body?.days === undefined ? undefined : asNullableInt(body?.days),
      dateOccurred: body?.dateOccurred === undefined ? undefined : asNullableDate(body?.dateOccurred),
      ownerRole: body?.ownerRole === undefined ? undefined : asNullableString(body?.ownerRole),
      notes: body?.notes === undefined ? undefined : asNullableString(body?.notes),
    },
  });
}

export async function deleteMilestone(projectId: number, milestoneId: number) {
  const existing = await prisma.protocolMilestone.findUnique({
    where: { id: milestoneId },
    select: { id: true, projectId: true },
  });
  if (!existing || existing.projectId !== projectId) {
    throw new AppError(404, "NOT_FOUND", "Milestone not found");
  }
  await prisma.protocolMilestone.delete({ where: { id: milestoneId } });
  return { success: true };
}

/* ------------------------------------------------------------------ */
/*  Create submission for project                                      */
/* ------------------------------------------------------------------ */
export async function createSubmissionForProject(
  projectId: number,
  body: {
    submissionType: string;
    receivedDate?: string;
    documentLink?: string;
    completenessStatus?: string;
    completenessRemarks?: string;
    remarks?: string;
  },
  userId: number,
  options: {
    allowInitial?: boolean;
  } = {}
) {
  const allowedSubmissionTypes = options.allowInitial
    ? [
        "INITIAL", "RESUBMISSION", "AMENDMENT", "CONTINUING_REVIEW", "FINAL_REPORT",
        "WITHDRAWAL", "SAFETY_REPORT", "PROTOCOL_DEVIATION",
      ]
    : [
        "RESUBMISSION", "AMENDMENT", "CONTINUING_REVIEW", "FINAL_REPORT",
        "WITHDRAWAL", "SAFETY_REPORT", "PROTOCOL_DEVIATION",
      ];
  if (!body.submissionType) {
    throw new AppError(400, "VALIDATION_ERROR", "submissionType is required");
  }
  if (!allowedSubmissionTypes.includes(body.submissionType)) {
    throw new AppError(400, "INVALID_SUBMISSION_TYPE",
      `Invalid submissionType. Allowed: ${allowedSubmissionTypes.join(", ")}`);
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, projectCode: true },
  });
  if (!project) {
    throw new AppError(404, "NOT_FOUND", "Project not found");
  }

  const allowedCompleteness = ["COMPLETE", "MINOR_MISSING", "MAJOR_MISSING", "MISSING_SIGNATURES", "OTHER"];
  if (body.completenessStatus && !allowedCompleteness.includes(body.completenessStatus)) {
    throw new AppError(400, "INVALID_COMPLETENESS",
      `Invalid completenessStatus. Allowed: ${allowedCompleteness.join(", ")}`);
  }

  const receivedAt = asNullableDate(body.receivedDate) ?? new Date();
  if (!receivedAt) {
    throw new AppError(400, "INVALID_DATE", "Invalid receivedDate");
  }

  return prisma.$transaction(async (tx) => {
    const lastSubmission = await tx.submission.findFirst({
      where: { projectId },
      orderBy: { sequenceNumber: "desc" },
      select: { sequenceNumber: true },
    });
    const sequenceNumber = (lastSubmission?.sequenceNumber ?? 0) + 1;

    const submission = await tx.submission.create({
      data: {
        projectId,
        submissionType: body.submissionType as SubmissionType,
        sequenceNumber,
        receivedDate: receivedAt,
        documentLink: body.documentLink,
        completenessStatus: (body.completenessStatus || "COMPLETE") as CompletenessStatus,
        completenessRemarks: body.completenessRemarks,
        remarks: body.remarks ?? body.completenessRemarks,
        status: SubmissionStatus.RECEIVED,
        createdById: userId,
      },
    });

    await tx.submissionStatusHistory.create({
      data: {
        submissionId: submission.id,
        oldStatus: null,
        newStatus: SubmissionStatus.RECEIVED,
        reason: `${body.submissionType} submission received`,
        changedById: userId,
      },
    });

    return submission;
  });
}
