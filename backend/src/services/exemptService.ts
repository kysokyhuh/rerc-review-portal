import prisma from "../config/prismaClient";
import { ProjectStatus, ReviewDecision, ReviewType, SubmissionStatus } from "../generated/prisma/client";
import { AppError } from "../middleware/errorHandler";
import { logAuditEvent } from "./audit/auditService";

type ListExemptedQueueParams = {
  page: number;
  pageSize: number;
  q?: string;
  college?: string;
  committee?: string;
};

const normalizeSearch = (value?: string) => value?.trim() ?? "";

const buildCommitteeWhere = (committee?: string) => {
  const normalized = committee?.trim();
  if (!normalized) return {};
  if (/^\d+$/.test(normalized)) {
    return { committeeId: Number(normalized) };
  }
  return { committee: { code: normalized } };
};

export async function listExemptedQueue(params: ListExemptedQueueParams) {
  const page = Number.isFinite(params.page) ? Math.max(1, Math.floor(params.page)) : 1;
  const pageSize = Number.isFinite(params.pageSize)
    ? Math.min(100, Math.max(1, Math.floor(params.pageSize)))
    : 20;
  const q = normalizeSearch(params.q);

  const where: Record<string, unknown> = {
    status: { notIn: [SubmissionStatus.CLOSED, SubmissionStatus.WITHDRAWN] },
    classification: {
      reviewType: ReviewType.EXEMPT,
    },
    project: {
      ...buildCommitteeWhere(params.committee),
      deletedAt: null,
      purgedAt: null,
      ...(params.college?.trim()
        ? {
            OR: [
              { piAffiliation: params.college.trim() },
              { collegeOrUnit: params.college.trim() },
            ],
          }
        : {}),
    },
  };

  if (q) {
    where.OR = [
      { project: { projectCode: { contains: q, mode: "insensitive" } } },
      { project: { title: { contains: q, mode: "insensitive" } } },
      { project: { piName: { contains: q, mode: "insensitive" } } },
      { project: { proponent: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [totalCount, rows] = await prisma.$transaction([
    prisma.submission.count({ where: where as any }),
    prisma.submission.findMany({
      where: where as any,
      include: {
        project: {
          select: {
            id: true,
            projectCode: true,
            title: true,
            piName: true,
            proponent: true,
            piAffiliation: true,
            collegeOrUnit: true,
            committeeId: true,
          },
        },
      },
      orderBy: [{ receivedDate: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    totalCount,
    items: rows.map((row) => ({
      id: row.id,
      projectId: row.project?.id ?? null,
      projectCode: row.project?.projectCode ?? "—",
      title: row.project?.title ?? "—",
      proponentOrLeader: row.project?.proponent ?? row.project?.piName ?? "—",
      college: row.project?.piAffiliation ?? row.project?.collegeOrUnit ?? "—",
      dateReceived: row.receivedDate,
      status: row.status,
      resultsNotifiedAt: row.resultsNotifiedAt,
    })),
    page,
    pageSize,
  };
}

export async function issueExemptionAndClose(
  submissionId: number,
  resultsNotifiedAtRaw: string,
  actorId: number
) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      classification: {
        select: {
          reviewType: true,
        },
      },
    },
  });

  if (!submission) {
    throw new AppError(404, "NOT_FOUND", "Submission not found");
  }

  if (!submission.classification || submission.classification.reviewType !== ReviewType.EXEMPT) {
    throw new AppError(400, "INVALID_REVIEW_TYPE", "Only EXEMPT submissions can be issued and closed");
  }

  if (submission.status === SubmissionStatus.CLOSED) {
    throw new AppError(400, "ALREADY_CLOSED", "Submission is already closed");
  }

  const resultsNotifiedAt = new Date(resultsNotifiedAtRaw);
  if (Number.isNaN(resultsNotifiedAt.getTime())) {
    throw new AppError(400, "INVALID_DATE", "Invalid resultsNotifiedAt");
  }

  const reason = "Exemption notice issued to proponent and submission closed";

  const updatedSubmission = await prisma.$transaction(async (tx) => {
    await tx.submissionStatusHistory.create({
      data: {
        submissionId,
        oldStatus: submission.status,
        newStatus: SubmissionStatus.CLOSED,
        reason,
        changedById: actorId,
      },
    });

    await tx.submissionDecision.upsert({
      where: { submissionId },
      update: {
        decision: ReviewDecision.APPROVED,
        decidedAt: resultsNotifiedAt,
        validFrom: resultsNotifiedAt,
        notes: reason,
      },
      create: {
        submissionId,
        decision: ReviewDecision.APPROVED,
        decidedAt: resultsNotifiedAt,
        validFrom: resultsNotifiedAt,
        notes: reason,
      },
    });

    return tx.submission.update({
      where: { id: submissionId },
      data: {
        status: SubmissionStatus.CLOSED,
        resultsNotifiedAt,
        finalDecision: ReviewDecision.APPROVED,
        finalDecisionDate: resultsNotifiedAt,
        project: {
          update: {
            overallStatus: ProjectStatus.ACTIVE,
            approvalStartDate: resultsNotifiedAt,
          },
        },
      },
      include: {
        project: true,
        classification: true,
      },
    });
  });

  await logAuditEvent({
    actorId,
    action: "EXEMPTION_ISSUED_AND_CLOSED",
    entityType: "Submission",
    entityId: submissionId,
    metadata: {
      oldStatus: submission.status,
      newStatus: SubmissionStatus.CLOSED,
      resultsNotifiedAt: resultsNotifiedAt.toISOString(),
    },
  });

  return updatedSubmission;
}
