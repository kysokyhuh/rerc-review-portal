import {
  Prisma,
  ProjectStatus,
  ReviewDecision,
  ReviewerRoleType,
  ReviewerRoundRole,
  ReviewType,
  SLAStage,
  SubmissionStatus,
  UserStatus,
} from "../../generated/prisma/client";
import {
  buildSlaConfigMap,
  computeDueDate,
  getConfiguredSlaOrDefault,
} from "../sla/submissionSlaService";

const LEGACY_SYNC_STATUS_TARGETS = new Set<SubmissionStatus>([
  SubmissionStatus.RECEIVED,
  SubmissionStatus.UNDER_COMPLETENESS_CHECK,
  SubmissionStatus.RETURNED_FOR_COMPLETION,
  SubmissionStatus.NOT_ACCEPTED,
  SubmissionStatus.AWAITING_CLASSIFICATION,
  SubmissionStatus.UNDER_CLASSIFICATION,
  SubmissionStatus.CLASSIFIED,
  SubmissionStatus.UNDER_REVIEW,
  SubmissionStatus.AWAITING_REVISIONS,
  SubmissionStatus.REVISION_SUBMITTED,
  SubmissionStatus.CLOSED,
  SubmissionStatus.WITHDRAWN,
]);

const LEGACY_REVIEW_ASSIGNMENT_STATUSES = new Set<SubmissionStatus>([
  SubmissionStatus.CLASSIFIED,
  SubmissionStatus.UNDER_REVIEW,
  SubmissionStatus.AWAITING_REVISIONS,
  SubmissionStatus.REVISION_SUBMITTED,
  SubmissionStatus.CLOSED,
]);

const LEGACY_STAGE_MILESTONES: Array<{
  orderIndex: number;
  label: string;
  ownerRole: string | null;
  dateCandidates: string[];
  daysCandidates: string[];
}> = [
  {
    orderIndex: 0,
    label: "Classification of Proposal (RERC)",
    ownerRole: "RERC Staff",
    dateCandidates: ["classificationDate", "Classification Date"],
    daysCandidates: ["classificationDays", "# days"],
  },
  {
    orderIndex: 10,
    label: "Provision of Documents & Assessment Forms to Primary Reviewer",
    ownerRole: "RERC Staff",
    dateCandidates: ["provisionOfProjectProposalDocumentsToPrimaryReviewer"],
    daysCandidates: ["provisionOfProjectProposalDocumentsToPrimaryReviewerDays"],
  },
  {
    orderIndex: 20,
    label: "Accomplishment of Assessment Forms",
    ownerRole: "Primary Reviewers",
    dateCandidates: ["accomplishmentOfAssessmentForms"],
    daysCandidates: ["accomplishmentOfAssessmentFormsDays"],
  },
  {
    orderIndex: 30,
    label: "Full Review Meeting",
    ownerRole: "RERP",
    dateCandidates: ["fullReviewMeeting"],
    daysCandidates: ["fullReviewMeetingDays"],
  },
  {
    orderIndex: 40,
    label: "Finalization of Review Results",
    ownerRole: "RERP Chair Designate",
    dateCandidates: ["finalizationOfReviewResults"],
    daysCandidates: ["finalizationOfReviewResultsDays"],
  },
  {
    orderIndex: 50,
    label: "Communication of Review Results to Project Leader",
    ownerRole: "RERC Chair/Staff",
    dateCandidates: ["communicationOfReviewResultsToProjectLeader"],
    daysCandidates: ["communicationOfReviewResultsToProjectLeaderDays"],
  },
  {
    orderIndex: 60,
    label: "1st Resubmission from Proponent",
    ownerRole: "RERC Staff",
    dateCandidates: ["resubmission1FromProponent"],
    daysCandidates: ["resubmission1FromProponentDays"],
  },
  {
    orderIndex: 70,
    label: "1st Review of Resubmission",
    ownerRole: "Primary Reviewers",
    dateCandidates: ["reviewOfResubmission1"],
    daysCandidates: ["reviewOfResubmission1Days"],
  },
  {
    orderIndex: 80,
    label: "1st Finalization of Review Results - Resubmission",
    ownerRole: "RERP Chair Designate",
    dateCandidates: ["finalizationOfReviewResultsResubmission1"],
    daysCandidates: ["finalizationOfReviewResultsResubmission1Days"],
  },
  {
    orderIndex: 90,
    label: "2nd Resubmission from Proponent",
    ownerRole: "RERC Staff",
    dateCandidates: ["resubmission2FromProponent"],
    daysCandidates: ["resubmission2FromProponentDays"],
  },
  {
    orderIndex: 100,
    label: "2nd Review of Resubmission",
    ownerRole: "Primary Reviewers",
    dateCandidates: ["reviewOfResubmission2"],
    daysCandidates: ["reviewOfResubmission2Days"],
  },
  {
    orderIndex: 110,
    label: "2nd Finalization of Review Results - Resubmission",
    ownerRole: "RERP Chair Designate",
    dateCandidates: ["finalizationOfReviewResultsResubmission2"],
    daysCandidates: ["finalizationOfReviewResultsResubmission2Days"],
  },
  {
    orderIndex: 120,
    label: "3rd Resubmission from Proponent",
    ownerRole: "RERC Staff",
    dateCandidates: ["resubmission3FromProponent"],
    daysCandidates: ["resubmission3FromProponentDays"],
  },
  {
    orderIndex: 130,
    label: "3rd Review of Resubmission",
    ownerRole: "Primary Reviewers",
    dateCandidates: ["reviewOfResubmission3"],
    daysCandidates: ["reviewOfResubmission3Days"],
  },
  {
    orderIndex: 140,
    label: "3rd Finalization of Review Results - Resubmission",
    ownerRole: "RERP Chair Designate",
    dateCandidates: ["finalizationOfReviewResultsResubmission3"],
    daysCandidates: ["finalizationOfReviewResultsResubmission3Days"],
  },
  {
    orderIndex: 150,
    label: "4th Resubmission from Proponent",
    ownerRole: "RERC Staff",
    dateCandidates: ["resubmission4FromProponent"],
    daysCandidates: ["resubmission4FromProponentDays"],
  },
  {
    orderIndex: 160,
    label: "4th Review of Resubmission",
    ownerRole: "Primary Reviewers",
    dateCandidates: ["reviewOfResubmission4"],
    daysCandidates: ["reviewOfResubmission4Days"],
  },
  {
    orderIndex: 170,
    label: "4th Finalization of Review Results - Resubmission",
    ownerRole: "RERP Chair Designate",
    dateCandidates: ["finalizationOfReviewResultsResubmission4"],
    daysCandidates: ["finalizationOfReviewResultsResubmission4Days"],
  },
  {
    orderIndex: 180,
    label: "Issuance of Ethics Clearance",
    ownerRole: "RERC and RERC Chair",
    dateCandidates: ["issuanceOfEthicsClearance"],
    daysCandidates: ["issuanceOfEthicsClearanceDays"],
  },
];

type LegacyMilestoneSeed = {
  orderIndex: number;
  label: string;
  ownerRole: string | null;
  dateOccurred: Date | null;
  days: number | null;
  notes: string | null;
};

export type LegacyWorkflowSyncPayload = {
  status: string | null;
  typeOfReview: string | null;
  classificationOfProposalRerc: string | null;
  withdrawn: boolean | null;
  finishDate: Date | null;
  classificationDate?: Date | null;
  dateOfSubmission: Date | null;
  panel: string | null;
  primaryReviewer: string | null;
  scientistReviewer: string | null;
  layReviewer: string | null;
  finalLayReviewer: string | null;
  independentConsultant: string | null;
  clearanceExpiration?: Date | null;
  projectEndDate6A?: Date | null;
  progressReportTargetDate?: Date | null;
  progressReportSubmission?: Date | null;
  progressReportApprovalDate?: Date | null;
  progressReportStatus?: string | null;
  progressReportDays?: number | null;
  finalReportTargetDate?: Date | null;
  finalReportSubmission?: Date | null;
  finalReportCompletionDate?: Date | null;
  finalReportStatus?: string | null;
  finalReportDays?: number | null;
  amendmentSubmission?: Date | null;
  amendmentStatus?: string | null;
  amendmentApprovalDate?: Date | null;
  amendmentDays?: number | null;
  continuingSubmission?: Date | null;
  continuingStatus?: string | null;
  continuingApprovalDate?: Date | null;
  continuingDays?: number | null;
  remarks?: string | null;
  rawRowJson?: Record<string, string> | null;
};

const asNullableString = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
};

const normalizeHeaderKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const normalizeCellValue = (value: unknown) => String(value ?? "").trim();

const parseImportedDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseImportedInt = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
};

const sameDate = (left: Date | null | undefined, right: Date | null | undefined) => {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return left.getTime() === right.getTime();
};

const normalizeReviewTypeFromLegacyText = (
  value: string | null | undefined
): ReviewType | null => {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes("exempt")) return ReviewType.EXEMPT;
  if (raw.includes("expedit")) return ReviewType.EXPEDITED;
  if (raw.includes("full")) return ReviewType.FULL_BOARD;
  return null;
};

const normalizeSubmissionStatusFromLegacyText = (
  value: string | null | undefined
): SubmissionStatus | null => {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes("withdraw")) return SubmissionStatus.WITHDRAWN;
  if (raw.includes("not accepted") || raw.includes("beyond jurisdiction")) {
    return SubmissionStatus.NOT_ACCEPTED;
  }
  if (raw.includes("return") && raw.includes("completion")) {
    return SubmissionStatus.RETURNED_FOR_COMPLETION;
  }
  if (raw.includes("completeness") || raw.includes("screen")) {
    return SubmissionStatus.UNDER_COMPLETENESS_CHECK;
  }
  if (raw.includes("awaiting classification")) return SubmissionStatus.AWAITING_CLASSIFICATION;
  if (raw.includes("under classification")) return SubmissionStatus.UNDER_CLASSIFICATION;
  if (raw.includes("classification")) return SubmissionStatus.CLASSIFIED;
  if (raw.includes("revision submitted")) return SubmissionStatus.REVISION_SUBMITTED;
  if (raw.includes("revision")) return SubmissionStatus.AWAITING_REVISIONS;
  if (raw.includes("under review")) return SubmissionStatus.UNDER_REVIEW;
  if (
    raw.includes("clear") ||
    raw.includes("approved") ||
    raw.includes("finish") ||
    raw.includes("closed") ||
    raw.includes("complete")
  ) {
    return SubmissionStatus.CLOSED;
  }
  if (raw.includes("exempt")) return SubmissionStatus.CLASSIFIED;
  if (raw.includes("expedit") || raw.includes("full")) return SubmissionStatus.UNDER_REVIEW;
  return null;
};

const resolveLegacyWorkflowTargetStatus = (params: {
  rawStatus: string | null;
  reviewType: ReviewType | null;
  withdrawn: boolean | null;
  finishDate: Date | null;
}) => {
  if (params.withdrawn === true) return SubmissionStatus.WITHDRAWN;
  const parsed = normalizeSubmissionStatusFromLegacyText(params.rawStatus);
  if (parsed) return parsed;
  if (params.finishDate) return SubmissionStatus.CLOSED;
  if (params.reviewType === ReviewType.EXEMPT) return SubmissionStatus.CLASSIFIED;
  if (
    params.reviewType === ReviewType.EXPEDITED ||
    params.reviewType === ReviewType.FULL_BOARD
  ) {
    return SubmissionStatus.UNDER_REVIEW;
  }
  return SubmissionStatus.AWAITING_CLASSIFICATION;
};

const isLegacyWorkflowSyncRequested = (data: LegacyWorkflowSyncPayload) =>
  Boolean(
    data.status ||
      data.typeOfReview ||
      data.classificationOfProposalRerc ||
      data.primaryReviewer ||
      data.scientistReviewer ||
      data.layReviewer ||
      data.finalLayReviewer ||
      data.independentConsultant ||
      data.finishDate ||
      data.withdrawn === true ||
      data.rawRowJson
  );

const getActiveSlaContext = async (tx: Prisma.TransactionClient, committeeId: number) => {
  const [configs, holidayRows] = await Promise.all([
    tx.configSLA.findMany({
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
    tx.holiday.findMany({
      select: { date: true },
    }),
  ]);

  return {
    configMap: buildSlaConfigMap(configs),
    holidayDates: holidayRows.map((row) => row.date),
  };
};

const getRawByCandidates = (raw: Record<string, string> | null | undefined, candidates: string[]) => {
  if (!raw) return "";
  const byNormalized = new Map<string, string>();
  for (const [header, value] of Object.entries(raw)) {
    byNormalized.set(normalizeHeaderKey(header), normalizeCellValue(value));
  }
  for (const candidate of candidates) {
    const matched = byNormalized.get(normalizeHeaderKey(candidate));
    if (matched) return matched;
  }
  return "";
};

const getRawDate = (raw: Record<string, string> | null | undefined, candidates: string[]) =>
  parseImportedDate(getRawByCandidates(raw, candidates));

const getRawInt = (raw: Record<string, string> | null | undefined, candidates: string[]) =>
  parseImportedInt(getRawByCandidates(raw, candidates));

const firstDate = (...values: Array<Date | null | undefined>) => {
  for (const value of values) {
    if (value && !Number.isNaN(value.getTime())) return value;
  }
  return null;
};

const buildMilestoneSeeds = (data: LegacyWorkflowSyncPayload): LegacyMilestoneSeed[] => {
  const raw = data.rawRowJson ?? null;
  const seeds: LegacyMilestoneSeed[] = LEGACY_STAGE_MILESTONES.map((definition) => ({
    orderIndex: definition.orderIndex,
    label: definition.label,
    ownerRole: definition.ownerRole,
    dateOccurred: getRawDate(raw, definition.dateCandidates),
    days: getRawInt(raw, definition.daysCandidates),
    notes: null,
  })).filter((seed) => seed.dateOccurred || seed.days !== null);

  const append = (
    orderIndex: number,
    label: string,
    ownerRole: string | null,
    dateOccurred: Date | null | undefined,
    days: number | null | undefined,
    notes?: string | null
  ) => {
    if (!dateOccurred && days == null && !notes) return;
    seeds.push({
      orderIndex,
      label,
      ownerRole,
      dateOccurred: dateOccurred ?? null,
      days: days ?? null,
      notes: notes ?? null,
    });
  };

  append(
    5,
    "Classification of Proposal (RERC)",
    "RERC Staff",
    data.classificationDate,
    null
  );
  append(
    200,
    "Progress Report Target",
    "Project Leader / RERC Staff",
    data.progressReportTargetDate,
    data.progressReportDays,
    data.progressReportStatus ? `Status: ${data.progressReportStatus}` : null
  );
  append(
    210,
    "Progress Report Submission",
    "Project Leader / RERC Staff",
    data.progressReportSubmission,
    data.progressReportDays,
    data.progressReportStatus ? `Status: ${data.progressReportStatus}` : null
  );
  append(
    220,
    "Progress Report Approval",
    "RERC Chair/Staff",
    data.progressReportApprovalDate,
    data.progressReportDays,
    data.progressReportStatus ? `Status: ${data.progressReportStatus}` : null
  );
  append(
    230,
    "Final Report Target",
    "Project Leader / RERC Staff",
    data.finalReportTargetDate,
    data.finalReportDays,
    data.finalReportStatus ? `Status: ${data.finalReportStatus}` : null
  );
  append(
    240,
    "Final Report Submission",
    "Project Leader / RERC Staff",
    data.finalReportSubmission,
    data.finalReportDays,
    data.finalReportStatus ? `Status: ${data.finalReportStatus}` : null
  );
  append(
    250,
    "Final Report Completion",
    "RERC Chair/Staff",
    data.finalReportCompletionDate,
    data.finalReportDays,
    data.finalReportStatus ? `Status: ${data.finalReportStatus}` : null
  );
  append(
    260,
    "Amendment Submission",
    "Project Leader / RERC Staff",
    data.amendmentSubmission,
    data.amendmentDays,
    data.amendmentStatus ? `Status: ${data.amendmentStatus}` : null
  );
  append(
    270,
    "Amendment Approval",
    "RERC Chair/Staff",
    data.amendmentApprovalDate,
    data.amendmentDays,
    data.amendmentStatus ? `Status: ${data.amendmentStatus}` : null
  );
  append(
    280,
    "Continuing Review Submission",
    "Project Leader / RERC Staff",
    data.continuingSubmission,
    data.continuingDays,
    data.continuingStatus ? `Status: ${data.continuingStatus}` : null
  );
  append(
    290,
    "Continuing Review Approval",
    "RERC Chair/Staff",
    data.continuingApprovalDate,
    data.continuingDays,
    data.continuingStatus ? `Status: ${data.continuingStatus}` : null
  );

  return seeds.sort((left, right) => left.orderIndex - right.orderIndex);
};

const resolveApprovalWindow = (
  currentStart: Date | null | undefined,
  currentEnd: Date | null | undefined,
  data: LegacyWorkflowSyncPayload,
  targetStatus: SubmissionStatus,
  reviewType: ReviewType | null,
  classificationDate: Date | null
) => {
  const nextStart =
    currentStart ??
    firstDate(
      data.finishDate,
      data.finalReportCompletionDate,
      getRawDate(data.rawRowJson ?? null, ["issuanceOfEthicsClearance"]),
      reviewType === ReviewType.EXEMPT ? classificationDate : null,
      data.progressReportApprovalDate,
      data.amendmentApprovalDate,
      data.continuingApprovalDate
    );

  const nextEnd = currentEnd ?? data.clearanceExpiration ?? data.projectEndDate6A ?? null;

  return {
    approvalStartDate:
      targetStatus === SubmissionStatus.CLOSED || reviewType === ReviewType.EXEMPT
        ? nextStart
        : currentStart ?? null,
    approvalEndDate: nextEnd,
  };
};

const resolveCurrentProjectStatus = (
  currentStatus: ProjectStatus,
  targetStatus: SubmissionStatus
) => {
  if (targetStatus === SubmissionStatus.WITHDRAWN) return ProjectStatus.WITHDRAWN;
  if (targetStatus === SubmissionStatus.CLOSED) return ProjectStatus.CLOSED;
  return currentStatus;
};

const createMilestonesIfMissing = async (
  tx: Prisma.TransactionClient,
  projectId: number,
  seeds: LegacyMilestoneSeed[]
) => {
  if (seeds.length === 0) return;

  const existing = await tx.protocolMilestone.findMany({
    where: { projectId },
    select: {
      id: true,
      orderIndex: true,
      label: true,
      dateOccurred: true,
      days: true,
      ownerRole: true,
      notes: true,
    },
  });

  for (const seed of seeds) {
    const alreadyExists = existing.some(
      (item) =>
        item.orderIndex === seed.orderIndex &&
        item.label === seed.label &&
        sameDate(item.dateOccurred, seed.dateOccurred) &&
        (item.days ?? null) === (seed.days ?? null) &&
        (item.ownerRole ?? null) === (seed.ownerRole ?? null) &&
        (item.notes ?? null) === (seed.notes ?? null)
    );

    if (alreadyExists) continue;

    await tx.protocolMilestone.create({
      data: {
        projectId,
        orderIndex: seed.orderIndex,
        label: seed.label,
        dateOccurred: seed.dateOccurred,
        days: seed.days,
        ownerRole: seed.ownerRole,
        notes: seed.notes,
      },
    });
  }
};

const resolveReviewerNote = (
  roleLabel: string,
  reviewerValue: string | null,
  resolved: boolean
) => {
  if (!reviewerValue || resolved) return null;
  return `${roleLabel}: ${reviewerValue}`;
};

const buildLegacyEventTimeline = (params: {
  workflowStartDate: Date;
  classificationDate: Date | null;
  underReviewDate: Date | null;
  resultsCommunicatedAt: Date | null;
  revisionSubmittedAt: Date | null;
  closureDate: Date | null;
  targetStatus: SubmissionStatus;
  reviewType: ReviewType | null;
  withdrawn: boolean | null;
}) => {
  const entries: Array<{
    status: SubmissionStatus;
    effectiveDate: Date;
    reason: string;
  }> = [
    {
      status: SubmissionStatus.AWAITING_CLASSIFICATION,
      effectiveDate: params.workflowStartDate,
      reason: "Imported record entered the live workflow from a legacy spreadsheet.",
    },
  ];

  if (params.classificationDate) {
    entries.push({
      status: SubmissionStatus.CLASSIFIED,
      effectiveDate: params.classificationDate,
      reason: "Imported legacy classification mapped into the live workflow.",
    });
  }

  if (
    params.reviewType &&
    params.reviewType !== ReviewType.EXEMPT &&
    params.underReviewDate &&
    params.targetStatus !== SubmissionStatus.AWAITING_CLASSIFICATION &&
    params.targetStatus !== SubmissionStatus.UNDER_CLASSIFICATION &&
    params.targetStatus !== SubmissionStatus.CLASSIFIED
  ) {
    entries.push({
      status: SubmissionStatus.UNDER_REVIEW,
      effectiveDate: params.underReviewDate,
      reason: "Imported reviewer workflow mapped into the live workflow.",
    });
  }

  if (
    params.resultsCommunicatedAt &&
    (params.targetStatus === SubmissionStatus.AWAITING_REVISIONS ||
      params.targetStatus === SubmissionStatus.REVISION_SUBMITTED ||
      params.targetStatus === SubmissionStatus.CLOSED)
  ) {
    entries.push({
      status: SubmissionStatus.AWAITING_REVISIONS,
      effectiveDate: params.resultsCommunicatedAt,
      reason: "Imported revision request mapped into the live workflow.",
    });
  }

  if (params.revisionSubmittedAt && params.targetStatus === SubmissionStatus.REVISION_SUBMITTED) {
    entries.push({
      status: SubmissionStatus.REVISION_SUBMITTED,
      effectiveDate: params.revisionSubmittedAt,
      reason: "Imported revision submission mapped into the live workflow.",
    });
  }

  if (params.targetStatus === SubmissionStatus.WITHDRAWN) {
    entries.push({
      status: SubmissionStatus.WITHDRAWN,
      effectiveDate:
        params.closureDate ?? params.resultsCommunicatedAt ?? params.workflowStartDate,
      reason: params.withdrawn
        ? "Imported record marked withdrawn from legacy source."
        : "Imported legacy status mapped into withdrawn state.",
    });
  }

  if (params.targetStatus === SubmissionStatus.CLOSED) {
    entries.push({
      status: SubmissionStatus.CLOSED,
      effectiveDate:
        params.closureDate ?? params.resultsCommunicatedAt ?? params.workflowStartDate,
      reason: "Imported record mapped into a closed workflow state.",
    });
  }

  const uniqueEntries = new Map<string, (typeof entries)[number]>();
  for (const entry of entries) {
    const key = `${entry.status}|${entry.effectiveDate.toISOString()}`;
    if (!uniqueEntries.has(key)) {
      uniqueEntries.set(key, entry);
    }
  }

  return Array.from(uniqueEntries.values()).sort(
    (left, right) => left.effectiveDate.getTime() - right.effectiveDate.getTime()
  );
};

const ensureHistoryEntries = async (
  tx: Prisma.TransactionClient,
  submissionId: number,
  existingHistory: Array<{ newStatus: SubmissionStatus; effectiveDate: Date }>,
  timeline: Array<{ status: SubmissionStatus; effectiveDate: Date; reason: string }>,
  changedById: number
) => {
  let previousStatus: SubmissionStatus | null = null;
  const known = [...existingHistory].sort(
    (left, right) => left.effectiveDate.getTime() - right.effectiveDate.getTime()
  );

  for (const item of timeline) {
    const alreadyExists = known.some(
      (entry) => entry.newStatus === item.status && sameDate(entry.effectiveDate, item.effectiveDate)
    );
    if (!alreadyExists) {
      await tx.submissionStatusHistory.create({
        data: {
          submissionId,
          oldStatus: previousStatus,
          newStatus: item.status,
          effectiveDate: item.effectiveDate,
          reason: item.reason,
          changedById,
        },
      });
      known.push({ newStatus: item.status, effectiveDate: item.effectiveDate });
    }
    previousStatus = item.status;
  }
};

export const syncLegacyProfileToWorkflow = async (
  tx: Prisma.TransactionClient,
  params: {
    projectId: number;
    committeeId: number;
    projectStatus: ProjectStatus;
    sourceSubmissionId: number | null;
    changedById: number;
    data: LegacyWorkflowSyncPayload;
  }
) => {
  if (!isLegacyWorkflowSyncRequested(params.data)) {
    return;
  }

  const sourceSubmission = params.sourceSubmissionId
    ? await tx.submission.findFirst({
        where: {
          id: params.sourceSubmissionId,
          projectId: params.projectId,
        },
        include: {
          classification: true,
          reviews: true,
          statusHistory: {
            orderBy: { effectiveDate: "asc" },
            select: {
              newStatus: true,
              effectiveDate: true,
            },
          },
          project: {
            select: {
              approvalStartDate: true,
              approvalEndDate: true,
            },
          },
        },
      })
    : null;

  const submission =
    sourceSubmission ??
    (await tx.submission.findFirst({
      where: { projectId: params.projectId },
      orderBy: [{ sequenceNumber: "asc" }, { id: "asc" }],
      include: {
        classification: true,
        reviews: true,
        statusHistory: {
          orderBy: { effectiveDate: "asc" },
          select: {
            newStatus: true,
            effectiveDate: true,
          },
        },
        project: {
          select: {
            approvalStartDate: true,
            approvalEndDate: true,
          },
        },
      },
    }));

  if (!submission) {
    return;
  }

  const reviewType =
    normalizeReviewTypeFromLegacyText(params.data.typeOfReview) ??
    normalizeReviewTypeFromLegacyText(params.data.classificationOfProposalRerc);
  let targetStatus = resolveLegacyWorkflowTargetStatus({
    rawStatus: params.data.status,
    reviewType,
    withdrawn: params.data.withdrawn,
    finishDate: params.data.finishDate ?? params.data.finalReportCompletionDate ?? null,
  });
  if (reviewType === ReviewType.EXEMPT && targetStatus === SubmissionStatus.UNDER_REVIEW) {
    targetStatus = SubmissionStatus.CLASSIFIED;
  }
  if (!reviewType && targetStatus === SubmissionStatus.UNDER_REVIEW) {
    targetStatus = SubmissionStatus.CLASSIFIED;
  }
  if (!LEGACY_SYNC_STATUS_TARGETS.has(targetStatus)) {
    return;
  }

  const { configMap, holidayDates } = await getActiveSlaContext(tx, params.committeeId);
  const workflowStartDate =
    submission.receivedDate ?? params.data.dateOfSubmission ?? submission.createdAt;
  const classificationDate =
    submission.classification?.classificationDate ??
    params.data.classificationDate ??
    getRawDate(params.data.rawRowJson ?? null, ["classificationDate", "Classification Date"]) ??
    params.data.dateOfSubmission ??
    workflowStartDate;

  let panelId = submission.classification?.panelId ?? null;
  const panelText = asNullableString(params.data.panel);
  if (panelText) {
    const panel = await tx.panel.findFirst({
      where: {
        committeeId: params.committeeId,
        OR: [
          { name: { equals: panelText, mode: "insensitive" } },
          { code: { equals: panelText, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    panelId = panel?.id ?? panelId;
  }

  if (reviewType) {
    await tx.classification.upsert({
      where: { submissionId: submission.id },
      update: {
        reviewType,
        classificationDate,
        panelId,
      },
      create: {
        submissionId: submission.id,
        reviewType,
        classificationDate,
        panelId,
        classifiedById: params.changedById,
      },
    });
  }

  const resolveReviewerUserId = async (label: string | null) => {
    const normalized = asNullableString(label);
    if (!normalized) return null;
    const user = await tx.user.findFirst({
      where: {
        isActive: true,
        status: UserStatus.APPROVED,
        OR: [
          { fullName: { equals: normalized, mode: "insensitive" } },
          { email: { equals: normalized, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    return user?.id ?? null;
  };

  const reviewDueBaseDate =
    getRawDate(params.data.rawRowJson ?? null, [
      "provisionOfProjectProposalDocumentsToPrimaryReviewer",
      "accomplishmentOfAssessmentForms",
      "fullReviewMeeting",
    ]) ?? classificationDate;
  const reviewSlaConfig =
    reviewType === ReviewType.EXPEDITED || reviewType === ReviewType.FULL_BOARD
      ? getConfiguredSlaOrDefault(configMap, params.committeeId, SLAStage.REVIEW, reviewType)
      : null;
  const reviewDueDate =
    reviewSlaConfig && reviewDueBaseDate
      ? computeDueDate(
          reviewSlaConfig.dayMode,
          reviewDueBaseDate,
          reviewSlaConfig.targetDays,
          holidayDates
        )
      : null;

  const upsertReviewer = async (
    reviewerId: number,
    reviewerRole: ReviewerRoleType,
    assignmentRole: ReviewerRoundRole | null,
    isPrimary: boolean
  ) => {
    await tx.review.upsert({
      where: {
        submissionId_reviewerId: {
          submissionId: submission.id,
          reviewerId,
        },
      },
      update: {
        reviewerRole,
        isPrimary,
        dueDate: reviewDueDate,
      },
      create: {
        submissionId: submission.id,
        reviewerId,
        reviewerRole,
        isPrimary,
        dueDate: reviewDueDate,
      },
    });

    if (!assignmentRole) return;

    await tx.reviewAssignment.upsert({
      where: {
        submissionId_roundSequence_reviewerRole: {
          submissionId: submission.id,
          roundSequence: submission.sequenceNumber,
          reviewerRole: assignmentRole,
        },
      },
      update: {
        reviewerId,
        dueDate: reviewDueDate,
        isActive: true,
        endedAt: null,
        submittedAt: null,
      },
      create: {
        submissionId: submission.id,
        roundSequence: submission.sequenceNumber,
        reviewerId,
        reviewerRole: assignmentRole,
        dueDate: reviewDueDate,
      },
    });
  };

  const unresolvedReviewerNotes: string[] = [];

  if (
    reviewType &&
    reviewType !== ReviewType.EXEMPT &&
    LEGACY_REVIEW_ASSIGNMENT_STATUSES.has(targetStatus)
  ) {
    const scientificReviewerValue =
      params.data.primaryReviewer ?? params.data.scientistReviewer;
    const scientificReviewerId = await resolveReviewerUserId(scientificReviewerValue);
    if (scientificReviewerId) {
      await upsertReviewer(
        scientificReviewerId,
        ReviewerRoleType.SCIENTIST,
        ReviewerRoundRole.SCIENTIFIC,
        true
      );
    }
    const scientificNote = resolveReviewerNote(
      "Scientific reviewer",
      scientificReviewerValue,
      Boolean(scientificReviewerId)
    );
    if (scientificNote) unresolvedReviewerNotes.push(scientificNote);

    const layReviewerValue = params.data.finalLayReviewer ?? params.data.layReviewer;
    const layReviewerId = await resolveReviewerUserId(layReviewerValue);
    if (layReviewerId) {
      await upsertReviewer(layReviewerId, ReviewerRoleType.LAY, ReviewerRoundRole.LAY, false);
    }
    const layNote = resolveReviewerNote("Lay reviewer", layReviewerValue, Boolean(layReviewerId));
    if (layNote) unresolvedReviewerNotes.push(layNote);

    const consultantReviewerValue = params.data.independentConsultant;
    const consultantReviewerId = await resolveReviewerUserId(consultantReviewerValue);
    if (consultantReviewerId) {
      await upsertReviewer(
        consultantReviewerId,
        ReviewerRoleType.INDEPENDENT_CONSULTANT,
        null,
        false
      );
    }
    const consultantNote = resolveReviewerNote(
      "Independent consultant",
      consultantReviewerValue,
      Boolean(consultantReviewerId)
    );
    if (consultantNote) unresolvedReviewerNotes.push(consultantNote);
  }

  const classificationSlaConfig = getConfiguredSlaOrDefault(
    configMap,
    params.committeeId,
    SLAStage.CLASSIFICATION,
    null
  );
  const revisionSlaConfig = getConfiguredSlaOrDefault(
    configMap,
    params.committeeId,
    SLAStage.REVISION_RESPONSE,
    null
  );
  const exemptNotificationConfig =
    reviewType === ReviewType.EXEMPT
      ? getConfiguredSlaOrDefault(
          configMap,
          params.committeeId,
          SLAStage.EXEMPT_NOTIFICATION,
          ReviewType.EXEMPT
        )
      : null;

  const resultsCommunicatedAt =
    getRawDate(params.data.rawRowJson ?? null, [
      "communicationOfReviewResultsToProjectLeader",
      "finalizationOfReviewResults",
      "finalizationOfReviewResultsResubmission1",
      "finalizationOfReviewResultsResubmission2",
      "finalizationOfReviewResultsResubmission3",
      "finalizationOfReviewResultsResubmission4",
    ]) ??
    params.data.finishDate ??
    params.data.finalReportCompletionDate ??
    null;
  const revisionSubmittedAt =
    getRawDate(params.data.rawRowJson ?? null, [
      "resubmission1FromProponent",
      "resubmission2FromProponent",
      "resubmission3FromProponent",
      "resubmission4FromProponent",
    ]) ?? null;
  const closureDate =
    params.data.finishDate ??
    params.data.finalReportCompletionDate ??
    getRawDate(params.data.rawRowJson ?? null, ["issuanceOfEthicsClearance"]) ??
    params.data.progressReportApprovalDate ??
    params.data.amendmentApprovalDate ??
    params.data.continuingApprovalDate ??
    null;

  const nextResultsNotifiedAt =
    targetStatus === SubmissionStatus.AWAITING_REVISIONS ||
    targetStatus === SubmissionStatus.REVISION_SUBMITTED ||
    targetStatus === SubmissionStatus.CLOSED
      ? submission.resultsNotifiedAt ?? resultsCommunicatedAt ?? closureDate ?? workflowStartDate
      : submission.resultsNotifiedAt;

  const { approvalStartDate, approvalEndDate } = resolveApprovalWindow(
    submission.project?.approvalStartDate,
    submission.project?.approvalEndDate,
    params.data,
    targetStatus,
    reviewType,
    classificationDate
  );

  await tx.submission.update({
    where: { id: submission.id },
    data: {
      status: targetStatus,
      receivedDate: workflowStartDate,
      classificationDueDate:
        targetStatus === SubmissionStatus.AWAITING_CLASSIFICATION ||
        targetStatus === SubmissionStatus.UNDER_CLASSIFICATION
          ? classificationSlaConfig
            ? computeDueDate(
                classificationSlaConfig.dayMode,
                workflowStartDate,
                classificationSlaConfig.targetDays,
                holidayDates
              )
            : null
          : null,
      exemptNotificationDueDate:
        targetStatus === SubmissionStatus.CLASSIFIED &&
        reviewType === ReviewType.EXEMPT &&
        exemptNotificationConfig
          ? computeDueDate(
              exemptNotificationConfig.dayMode,
              classificationDate,
              exemptNotificationConfig.targetDays,
              holidayDates
            )
          : null,
      revisionDueDate:
        targetStatus === SubmissionStatus.AWAITING_REVISIONS
          ? revisionSlaConfig && nextResultsNotifiedAt
            ? computeDueDate(
                revisionSlaConfig.dayMode,
                nextResultsNotifiedAt,
                revisionSlaConfig.targetDays,
                holidayDates
              )
            : null
          : targetStatus === SubmissionStatus.REVISION_SUBMITTED
            ? submission.revisionDueDate
            : null,
      resultsNotifiedAt: nextResultsNotifiedAt,
      finalDecision:
        targetStatus === SubmissionStatus.CLOSED
          ? submission.finalDecision ?? ReviewDecision.APPROVED
          : targetStatus === SubmissionStatus.WITHDRAWN
            ? null
            : submission.finalDecision,
      finalDecisionDate:
        targetStatus === SubmissionStatus.CLOSED
          ? submission.finalDecisionDate ?? closureDate ?? workflowStartDate
          : targetStatus === SubmissionStatus.WITHDRAWN
            ? null
            : submission.finalDecisionDate,
    },
  });

  const nextProjectStatus = resolveCurrentProjectStatus(params.projectStatus, targetStatus);
  await tx.project.updateMany({
    where: { id: params.projectId },
    data: {
      overallStatus: nextProjectStatus,
      approvalStartDate,
      approvalEndDate,
      initialSubmissionDate: workflowStartDate,
    },
  });

  const milestones = buildMilestoneSeeds(params.data);
  if (unresolvedReviewerNotes.length > 0) {
    milestones.push({
      orderIndex: 295,
      label: "Imported reviewer references",
      ownerRole: "System import",
      dateOccurred: null,
      days: null,
      notes: unresolvedReviewerNotes.join("\n"),
    });
  }
  if (params.data.remarks) {
    milestones.push({
      orderIndex: 296,
      label: "Imported legacy remarks",
      ownerRole: "System import",
      dateOccurred: null,
      days: null,
      notes: params.data.remarks,
    });
  }
  await createMilestonesIfMissing(tx, params.projectId, milestones);

  const historyTimeline = buildLegacyEventTimeline({
    workflowStartDate,
    classificationDate,
    underReviewDate:
      getRawDate(params.data.rawRowJson ?? null, [
        "provisionOfProjectProposalDocumentsToPrimaryReviewer",
        "accomplishmentOfAssessmentForms",
        "fullReviewMeeting",
      ]) ?? classificationDate,
    resultsCommunicatedAt: nextResultsNotifiedAt,
    revisionSubmittedAt,
    closureDate,
    targetStatus,
    reviewType,
    withdrawn: params.data.withdrawn,
  });

  await ensureHistoryEntries(
    tx,
    submission.id,
    submission.statusHistory,
    historyTimeline,
    params.changedById
  );
};
