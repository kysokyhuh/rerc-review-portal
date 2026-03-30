import {
  ReviewType,
  SLAStage,
  SLADayMode,
  SubmissionStatus,
  type ReviewDecision,
} from "../../generated/prisma/client";
import { addWorkingDays, computeWorkingDaysBetween } from "../../utils/workingDays";
import type { OverdueOwnerRole } from "../../utils/overdueClassifier";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
export const SLA_DUE_SOON_THRESHOLD = 3;

type SlaStatus = "ON_TRACK" | "DUE_SOON" | "OVERDUE";

type SlaConfigRecord = {
  committeeId: number;
  stage: SLAStage;
  reviewType: ReviewType | null;
  workingDays: number;
  dayMode: SLADayMode;
  description?: string | null;
};

type StatusHistoryEntry = {
  newStatus: SubmissionStatus;
  effectiveDate: Date;
};

type ReviewEntryLike = {
  assignedAt: Date;
  dueDate?: Date | null;
  respondedAt?: Date | null;
  submittedAt?: Date | null;
  endedAt?: Date | null;
  isActive?: boolean;
};

type SubmissionSlaSubject = {
  id: number;
  createdAt: Date;
  receivedDate?: Date | null;
  status: SubmissionStatus;
  classificationDueDate?: Date | null;
  exemptNotificationDueDate?: Date | null;
  revisionDueDate?: Date | null;
  resultsNotifiedAt?: Date | null;
  finalDecision?: ReviewDecision | null;
  project?: {
    committeeId?: number | null;
    committee?: { code: string } | null;
  } | null;
  classification?: {
    reviewType: ReviewType;
    classificationDate: Date;
  } | null;
  statusHistory: StatusHistoryEntry[];
  reviews?: ReviewEntryLike[];
  reviewAssignments?: ReviewEntryLike[];
};

type SlaConfigResolved = {
  stage: SLAStage;
  reviewType: ReviewType | null;
  targetDays: number;
  dayMode: SLADayMode;
  description: string | null;
};

export const getDefaultSlaConfig = (
  stage: SLAStage,
  reviewType: ReviewType | null
): SlaConfigResolved | null => {
  if (stage === SLAStage.COMPLETENESS) {
    return {
      stage,
      reviewType: null,
      targetDays: 1,
      dayMode: SLADayMode.WORKING,
      description: "Completeness screening within 1 working day",
    };
  }
  if (stage === SLAStage.CLASSIFICATION) {
    return {
      stage,
      reviewType,
      targetDays: 14,
      dayMode: SLADayMode.CALENDAR,
      description: "Classification within 14 calendar days",
    };
  }
  if (stage === SLAStage.EXEMPT_NOTIFICATION) {
    return {
      stage,
      reviewType: ReviewType.EXEMPT,
      targetDays: 7,
      dayMode: SLADayMode.CALENDAR,
      description: "Notify proponents of exempted protocols within 7 calendar days",
    };
  }
  if (stage === SLAStage.REVIEW && reviewType === ReviewType.EXPEDITED) {
    return {
      stage,
      reviewType,
      targetDays: 20,
      dayMode: SLADayMode.WORKING,
      description: "Expedited review within 20 working days",
    };
  }
  if (stage === SLAStage.REVIEW && reviewType === ReviewType.FULL_BOARD) {
    return {
      stage,
      reviewType,
      targetDays: 30,
      dayMode: SLADayMode.WORKING,
      description: "Full board review within 30 working days",
    };
  }
  if (stage === SLAStage.REVISION_RESPONSE) {
    return {
      stage,
      reviewType: null,
      targetDays: 7,
      dayMode: SLADayMode.CALENDAR,
      description: "Researchers have up to 7 calendar days to respond to revisions",
    };
  }
  return null;
};

export type SerializedSlaWindow = {
  stage: SLAStage;
  label: string;
  dayMode: SLADayMode;
  targetDays: number;
  startedAt: string;
  dueDate: string;
  elapsedDays: number;
  remainingDays: number;
  slaStatus: SlaStatus;
  ownerRole: OverdueOwnerRole;
  ownerLabel: string;
  ownerIcon: string;
  ownerReason: string;
  reason: string;
  description: string | null;
};

export type SerializedSlaSummaryStage = {
  stage: SLAStage;
  label: string;
  dayMode: SLADayMode | null;
  configuredDays: number | null;
  start: string | null;
  end: string | null;
  dueDate: string | null;
  actualDays: number | null;
  remainingDays: number | null;
  withinSla: boolean | null;
  description: string | null;
  isActive: boolean;
  slaStatus: SlaStatus | null;
};

export type SerializedSubmissionSlaSummary = {
  submissionId: number;
  committeeCode: string | null;
  reviewType: ReviewType | null;
  current: SerializedSlaWindow | null;
  completeness: SerializedSlaSummaryStage;
  classification: SerializedSlaSummaryStage;
  exemptNotification: SerializedSlaSummaryStage;
  review: SerializedSlaSummaryStage;
  revisionResponse: SerializedSlaSummaryStage;
};

const OWNER_ROLE_META: Record<
  OverdueOwnerRole,
  { label: string; icon: string; reason: string }
> = {
  PROJECT_LEADER_RESEARCHER_PROPONENT: {
    label: "Researcher",
    icon: "\u25CE",
    reason: "Waiting on project leader/researcher/proponent action",
  },
  REVIEWER_GROUP: {
    label: "Reviewer",
    icon: "\u2611",
    reason: "Waiting on reviewer or consultant action",
  },
  RESEARCH_ASSOCIATE_PROCESSING_STAFF: {
    label: "Staff",
    icon: "\u25A3",
    reason: "Waiting on staff processing/routing",
  },
  COMMITTEE_CHAIRPERSON_DESIGNATE: {
    label: "Chairperson",
    icon: "\u2713",
    reason: "Waiting on chairperson decision/finalization",
  },
  UNASSIGNED_PROCESS_GAP: {
    label: "Unassigned",
    icon: "\u26A0",
    reason: "Missing actionable assignee or routing metadata",
  },
};

const STAGE_LABELS: Record<SLAStage, string> = {
  COMPLETENESS: "Completeness",
  CLASSIFICATION: "Classification",
  EXEMPT_NOTIFICATION: "Exempt notification",
  REVIEW: "Review",
  REVISION_RESPONSE: "Revision response",
  CONTINUING_REVIEW_DUE: "Continuing review",
  FINAL_REPORT_DUE: "Final report",
  MEMBERSHIP: "Membership",
  MEETING: "Meeting",
};

const CLASSIFICATION_ACTIVE_STATUSES = new Set<SubmissionStatus>([
  SubmissionStatus.AWAITING_CLASSIFICATION,
  SubmissionStatus.UNDER_CLASSIFICATION,
]);

const CLASSIFICATION_END_STATUSES = new Set<SubmissionStatus>([
  SubmissionStatus.CLASSIFIED,
  SubmissionStatus.RETURNED_FOR_COMPLETION,
  SubmissionStatus.NOT_ACCEPTED,
  SubmissionStatus.WITHDRAWN,
  SubmissionStatus.CLOSED,
]);

const REVIEW_END_STATUSES = new Set<SubmissionStatus>([
  SubmissionStatus.AWAITING_REVISIONS,
  SubmissionStatus.REVISION_SUBMITTED,
  SubmissionStatus.CLOSED,
  SubmissionStatus.WITHDRAWN,
]);

const COMPLETE_SCREENING_STATUSES = new Set<SubmissionStatus>([
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

const toUtcMidnight = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

const addCalendarDays = (start: Date, days: number) => {
  const normalized = toUtcMidnight(new Date(start));
  if (Number.isNaN(normalized.getTime()) || !Number.isFinite(days) || days <= 0) {
    return normalized;
  }
  return new Date(normalized.getTime() + Math.floor(days) * ONE_DAY_MS);
};

const computeCalendarDaysBetween = (start: Date, end: Date) => {
  const startDate = toUtcMidnight(new Date(start));
  const endDate = toUtcMidnight(new Date(end));
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 0;
  }
  if (endDate <= startDate) {
    return 0;
  }
  return Math.round((endDate.getTime() - startDate.getTime()) / ONE_DAY_MS);
};

export const computeElapsedDays = (
  dayMode: SLADayMode,
  start: Date,
  end: Date,
  holidays: Iterable<Date | string>
) =>
  dayMode === SLADayMode.WORKING
    ? computeWorkingDaysBetween(start, end, holidays)
    : computeCalendarDaysBetween(start, end);

export const computeDueDate = (
  dayMode: SLADayMode,
  start: Date,
  targetDays: number,
  holidays: Iterable<Date | string>
) =>
  dayMode === SLADayMode.WORKING
    ? addWorkingDays(start, targetDays, holidays)
    : addCalendarDays(start, targetDays);

const toConfigKey = (committeeId: number, stage: SLAStage, reviewType: ReviewType | null) =>
  `${committeeId}:${stage}:${reviewType ?? "null"}`;

type SlaConfigMap = {
  byKey: Map<string, SlaConfigResolved>;
  byStage: Map<string, SlaConfigResolved[]>;
};

export const buildSlaConfigMap = (configs: SlaConfigRecord[]): SlaConfigMap => {
  const byKey = new Map<string, SlaConfigResolved>();
  const byStage = new Map<string, SlaConfigResolved[]>();

  for (const config of configs) {
    const resolved: SlaConfigResolved = {
      stage: config.stage,
      reviewType: config.reviewType,
      targetDays: config.workingDays,
      dayMode: config.dayMode,
      description: config.description ?? null,
    };
    byKey.set(toConfigKey(config.committeeId, config.stage, config.reviewType), resolved);
    const stageKey = `${config.committeeId}:${config.stage}`;
    const rows = byStage.get(stageKey) ?? [];
    rows.push(resolved);
    byStage.set(stageKey, rows);
  }

  return { byKey, byStage };
};

export const getConfiguredSla = (
  configMap: SlaConfigMap,
  committeeId: number | null | undefined,
  stage: SLAStage,
  reviewType: ReviewType | null
): SlaConfigResolved | null => {
  if (!committeeId) return null;

  const specific = configMap.byKey.get(toConfigKey(committeeId, stage, reviewType));
  if (specific) return specific;

  const fallback = configMap.byKey.get(toConfigKey(committeeId, stage, null));
  if (fallback) return fallback;

  const stageRows = [...(configMap.byStage.get(`${committeeId}:${stage}`) ?? [])];
  if (!stageRows.length) return null;
  stageRows.sort((a, b) => a.targetDays - b.targetDays);
  return stageRows[0] ?? null;
};

export const getConfiguredSlaOrDefault = (
  configMap: SlaConfigMap,
  committeeId: number | null | undefined,
  stage: SLAStage,
  reviewType: ReviewType | null
) => getConfiguredSla(configMap, committeeId, stage, reviewType) ?? getDefaultSlaConfig(stage, reviewType);

const lastHistoryDate = (
  history: StatusHistoryEntry[],
  predicate: (status: SubmissionStatus) => boolean
) => {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (predicate(entry.newStatus)) return entry.effectiveDate;
  }
  return null;
};

const firstHistoryDate = (
  history: StatusHistoryEntry[],
  predicate: (status: SubmissionStatus) => boolean
) => {
  for (const entry of history) {
    if (predicate(entry.newStatus)) return entry.effectiveDate;
  }
  return null;
};

const firstHistoryDateAfter = (
  history: StatusHistoryEntry[],
  start: Date,
  predicate: (status: SubmissionStatus) => boolean
) => {
  const startTime = start.getTime();
  for (const entry of history) {
    if (entry.effectiveDate.getTime() < startTime) continue;
    if (predicate(entry.newStatus)) return entry.effectiveDate;
  }
  return null;
};

const buildCurrentWindow = (
  stage: SLAStage,
  config: SlaConfigResolved,
  start: Date,
  ownerRole: OverdueOwnerRole,
  reason: string,
  holidays: Iterable<Date | string>,
  now: Date,
  dueDateOverride?: Date | null
): SerializedSlaWindow => {
  const dueDate = dueDateOverride ?? computeDueDate(config.dayMode, start, config.targetDays, holidays);
  const elapsedDays = computeElapsedDays(config.dayMode, start, now, holidays);
  const remainingDays = config.targetDays - elapsedDays;
  const slaStatus: SlaStatus =
    remainingDays < 0 ? "OVERDUE" : remainingDays <= SLA_DUE_SOON_THRESHOLD ? "DUE_SOON" : "ON_TRACK";
  const ownerMeta = OWNER_ROLE_META[ownerRole];

  return {
    stage,
    label: STAGE_LABELS[stage],
    dayMode: config.dayMode,
    targetDays: config.targetDays,
    startedAt: start.toISOString(),
    dueDate: dueDate.toISOString(),
    elapsedDays,
    remainingDays,
    slaStatus,
    ownerRole,
    ownerLabel: ownerMeta.label,
    ownerIcon: ownerMeta.icon,
    ownerReason: ownerMeta.reason,
    reason,
    description: config.description,
  };
};

const buildSummaryStage = (
  stage: SLAStage,
  config: SlaConfigResolved | null,
  start: Date | null,
  end: Date | null,
  dueDate: Date | null,
  holidays: Iterable<Date | string>,
  now: Date
): SerializedSlaSummaryStage => {
  if (!config || !start) {
    return {
      stage,
      label: STAGE_LABELS[stage],
      dayMode: config?.dayMode ?? null,
      configuredDays: config?.targetDays ?? null,
      start: start?.toISOString() ?? null,
      end: end?.toISOString() ?? null,
      dueDate: dueDate?.toISOString() ?? null,
      actualDays: null,
      remainingDays: null,
      withinSla: null,
      description: config?.description ?? null,
      isActive: false,
      slaStatus: null,
    };
  }

  const effectiveEnd = end ?? now;
  const actualDays = computeElapsedDays(config.dayMode, start, effectiveEnd, holidays);
  const remainingDays = config.targetDays - actualDays;
  const slaStatus: SlaStatus =
    remainingDays < 0 ? "OVERDUE" : remainingDays <= SLA_DUE_SOON_THRESHOLD ? "DUE_SOON" : "ON_TRACK";

  return {
    stage,
    label: STAGE_LABELS[stage],
    dayMode: config.dayMode,
    configuredDays: config.targetDays,
    start: start.toISOString(),
    end: end?.toISOString() ?? null,
    dueDate: (dueDate ?? computeDueDate(config.dayMode, start, config.targetDays, holidays)).toISOString(),
    actualDays,
    remainingDays: end ? null : remainingDays,
    withinSla: actualDays <= config.targetDays,
    description: config.description,
    isActive: !end,
    slaStatus: end ? null : slaStatus,
  };
};

const resolveCompletenessSummary = (
  submission: SubmissionSlaSubject,
  config: SlaConfigResolved | null,
  holidays: Iterable<Date | string>,
  now: Date
) => {
  const start = submission.receivedDate ?? submission.createdAt;
  const end = firstHistoryDate(submission.statusHistory, (status) => COMPLETE_SCREENING_STATUSES.has(status));
  return buildSummaryStage(SLAStage.COMPLETENESS, config, start, end, null, holidays, now);
};

const resolveClassificationSummary = (
  submission: SubmissionSlaSubject,
  config: SlaConfigResolved | null,
  holidays: Iterable<Date | string>,
  now: Date
) => {
  const start =
    lastHistoryDate(submission.statusHistory, (status) => status === SubmissionStatus.AWAITING_CLASSIFICATION) ??
    lastHistoryDate(submission.statusHistory, (status) => status === SubmissionStatus.UNDER_CLASSIFICATION);

  if (!start) {
    return buildSummaryStage(SLAStage.CLASSIFICATION, config, null, null, submission.classificationDueDate ?? null, holidays, now);
  }

  const end =
    submission.classification?.classificationDate ??
    firstHistoryDateAfter(submission.statusHistory, start, (status) => CLASSIFICATION_END_STATUSES.has(status));

  return buildSummaryStage(
    SLAStage.CLASSIFICATION,
    config,
    start,
    CLASSIFICATION_ACTIVE_STATUSES.has(submission.status) ? null : end,
    submission.classificationDueDate ?? null,
    holidays,
    now
  );
};

const resolveExemptNotificationSummary = (
  submission: SubmissionSlaSubject,
  config: SlaConfigResolved | null,
  holidays: Iterable<Date | string>,
  now: Date
) => {
  if (submission.classification?.reviewType !== ReviewType.EXEMPT) {
    return buildSummaryStage(SLAStage.EXEMPT_NOTIFICATION, config, null, null, null, holidays, now);
  }

  const start = submission.classification.classificationDate;
  const end =
    submission.resultsNotifiedAt ??
    firstHistoryDateAfter(
      submission.statusHistory,
      start,
      (status) => status === SubmissionStatus.CLOSED || status === SubmissionStatus.WITHDRAWN
    );
  const isActive = submission.status === SubmissionStatus.CLASSIFIED && !submission.resultsNotifiedAt;

  return buildSummaryStage(
    SLAStage.EXEMPT_NOTIFICATION,
    config,
    start,
    isActive ? null : end,
    submission.exemptNotificationDueDate ?? null,
    holidays,
    now
  );
};

type NormalizedReviewEntry = {
  assignedAt: Date;
  dueDate: Date | null;
  endAt: Date | null;
  isActive: boolean;
};

const resolveReviewEntries = (
  submission: SubmissionSlaSubject,
  config: SlaConfigResolved | null,
  holidays: Iterable<Date | string>
): NormalizedReviewEntry[] => {
  if (!config) return [];
  const source =
    submission.reviewAssignments && submission.reviewAssignments.length > 0
      ? submission.reviewAssignments
      : submission.reviews ?? [];

  return source
    .map((entry) => {
      const assignedAt = new Date(entry.assignedAt);
      const explicitDue = entry.dueDate ? new Date(entry.dueDate) : null;
      const endAt = entry.submittedAt ?? entry.respondedAt ?? entry.endedAt ?? null;
      const isActive = entry.isActive ?? !endAt;
      return {
        assignedAt,
        dueDate: explicitDue ?? computeDueDate(config.dayMode, assignedAt, config.targetDays, holidays),
        endAt,
        isActive: Boolean(isActive) && !endAt,
      };
    })
    .filter((entry) => !Number.isNaN(entry.assignedAt.getTime()));
};

const resolveReviewSummary = (
  submission: SubmissionSlaSubject,
  config: SlaConfigResolved | null,
  holidays: Iterable<Date | string>,
  now: Date
) => {
  const entries = resolveReviewEntries(submission, config, holidays);
  if (!config || entries.length === 0) {
    return buildSummaryStage(SLAStage.REVIEW, config, null, null, null, holidays, now);
  }

  const start = entries.reduce(
    (min, entry) => (entry.assignedAt < min ? entry.assignedAt : min),
    entries[0].assignedAt
  );
  const activeEntries = entries.filter((entry) => entry.isActive);
  const completedEntries = entries.filter((entry) => entry.endAt);
  const end =
    activeEntries.length === 0 && completedEntries.length > 0
      ? completedEntries.reduce(
          (max, entry) => (entry.endAt! > max ? entry.endAt! : max),
          completedEntries[0].endAt!
        )
      : null;
  const dueDate =
    activeEntries.length > 0
      ? activeEntries.reduce(
          (min, entry) => (entry.dueDate && entry.dueDate < min ? entry.dueDate : min),
          activeEntries[0].dueDate ?? activeEntries[0].assignedAt
        )
      : completedEntries.reduce(
          (max, entry) => (entry.dueDate && entry.dueDate > max ? entry.dueDate : max),
          completedEntries[0].dueDate ?? completedEntries[0].assignedAt
        );

  return buildSummaryStage(SLAStage.REVIEW, config, start, end, dueDate ?? null, holidays, now);
};

const isRevisionDecision = (decision?: ReviewDecision | null) =>
  decision === "MINOR_REVISIONS" || decision === "MAJOR_REVISIONS";

const resolveRevisionSummary = (
  submission: SubmissionSlaSubject,
  config: SlaConfigResolved | null,
  holidays: Iterable<Date | string>,
  now: Date
) => {
  const historyStart = lastHistoryDate(
    submission.statusHistory,
    (status) => status === SubmissionStatus.AWAITING_REVISIONS
  );
  const start =
    historyStart && isRevisionDecision(submission.finalDecision)
      ? submission.resultsNotifiedAt ?? historyStart
      : historyStart;
  const historyEnd = lastHistoryDate(
    submission.statusHistory,
    (status) => status === SubmissionStatus.REVISION_SUBMITTED
  );
  const end =
    historyEnd && start && historyEnd.getTime() >= start.getTime()
      ? historyEnd
      : null;

  return buildSummaryStage(
    SLAStage.REVISION_RESPONSE,
    config,
    start,
    submission.status === SubmissionStatus.AWAITING_REVISIONS ? null : end,
    submission.revisionDueDate ?? null,
    holidays,
    now
  );
};

export const resolveCurrentSubmissionSla = (
  submission: SubmissionSlaSubject,
  configMap: SlaConfigMap,
  holidays: Iterable<Date | string>,
  now = new Date()
): SerializedSlaWindow | null => {
  const committeeId = submission.project?.committeeId ?? null;
  const reviewType = submission.classification?.reviewType ?? null;

  if (
    submission.status === SubmissionStatus.RECEIVED ||
    submission.status === SubmissionStatus.UNDER_COMPLETENESS_CHECK
  ) {
    const config = getConfiguredSlaOrDefault(configMap, committeeId, SLAStage.COMPLETENESS, null);
    const start = submission.receivedDate ?? submission.createdAt;
    if (!config || !start) return null;
    return buildCurrentWindow(
      SLAStage.COMPLETENESS,
      config,
      start,
      "RESEARCH_ASSOCIATE_PROCESSING_STAFF",
      "Completeness screening in progress",
      holidays,
      now
    );
  }

  if (CLASSIFICATION_ACTIVE_STATUSES.has(submission.status)) {
    const config = getConfiguredSlaOrDefault(configMap, committeeId, SLAStage.CLASSIFICATION, reviewType);
    const start =
      lastHistoryDate(submission.statusHistory, (status) => status === SubmissionStatus.AWAITING_CLASSIFICATION) ??
      lastHistoryDate(submission.statusHistory, (status) => status === SubmissionStatus.UNDER_CLASSIFICATION) ??
      submission.receivedDate ??
      submission.createdAt;
    if (!config || !start) return null;
    const ownerRole =
      submission.status === SubmissionStatus.UNDER_CLASSIFICATION
        ? "COMMITTEE_CHAIRPERSON_DESIGNATE"
        : "RESEARCH_ASSOCIATE_PROCESSING_STAFF";
    return buildCurrentWindow(
      SLAStage.CLASSIFICATION,
      config,
      start,
      ownerRole,
      "Classification countdown started when the submission entered classification.",
      holidays,
      now,
      submission.classificationDueDate ?? null
    );
  }

  if (
    submission.status === SubmissionStatus.CLASSIFIED &&
    submission.classification?.reviewType === ReviewType.EXEMPT &&
    !submission.resultsNotifiedAt
  ) {
    const config = getConfiguredSlaOrDefault(configMap, committeeId, SLAStage.EXEMPT_NOTIFICATION, ReviewType.EXEMPT);
    const start = submission.classification.classificationDate;
    if (!config || !start) return null;
    return buildCurrentWindow(
      SLAStage.EXEMPT_NOTIFICATION,
      config,
      start,
      "RESEARCH_ASSOCIATE_PROCESSING_STAFF",
      "Notify the researcher of the exempted outcome.",
      holidays,
      now,
      submission.exemptNotificationDueDate ?? null
    );
  }

  if (
    submission.status === SubmissionStatus.UNDER_REVIEW &&
    (reviewType === ReviewType.EXPEDITED || reviewType === ReviewType.FULL_BOARD)
  ) {
    const config = getConfiguredSlaOrDefault(configMap, committeeId, SLAStage.REVIEW, reviewType);
    if (!config) return null;
    const activeEntries = resolveReviewEntries(submission, config, holidays)
      .filter((entry) => entry.isActive)
      .sort((a, b) => {
        const aDue = a.dueDate?.getTime() ?? a.assignedAt.getTime();
        const bDue = b.dueDate?.getTime() ?? b.assignedAt.getTime();
        return aDue - bDue;
      });
    const nextEntry = activeEntries[0];
    if (!nextEntry) return null;
    return buildCurrentWindow(
      SLAStage.REVIEW,
      config,
      nextEntry.assignedAt,
      "REVIEWER_GROUP",
      "Reviewer countdown starts from assignment.",
      holidays,
      now,
      nextEntry.dueDate
    );
  }

  if (submission.status === SubmissionStatus.AWAITING_REVISIONS) {
    const config = getConfiguredSlaOrDefault(configMap, committeeId, SLAStage.REVISION_RESPONSE, null);
    const start =
      submission.resultsNotifiedAt ??
      lastHistoryDate(submission.statusHistory, (status) => status === SubmissionStatus.AWAITING_REVISIONS);
    if (!config || !start) return null;
    return buildCurrentWindow(
      SLAStage.REVISION_RESPONSE,
      config,
      start,
      "PROJECT_LEADER_RESEARCHER_PROPONENT",
      "Revision countdown starts when the researcher is notified.",
      holidays,
      now,
      submission.revisionDueDate ?? null
    );
  }

  return null;
};

export const buildSubmissionSlaSummary = (
  submission: SubmissionSlaSubject,
  configs: SlaConfigRecord[],
  holidays: Iterable<Date | string>,
  now = new Date()
): SerializedSubmissionSlaSummary => {
  const committeeId = submission.project?.committeeId ?? null;
  const reviewType = submission.classification?.reviewType ?? null;
  const configMap = buildSlaConfigMap(configs);

  const completenessConfig = getConfiguredSlaOrDefault(configMap, committeeId, SLAStage.COMPLETENESS, null);
  const classificationConfig = getConfiguredSlaOrDefault(configMap, committeeId, SLAStage.CLASSIFICATION, reviewType);
  const exemptNotificationConfig = getConfiguredSlaOrDefault(
    configMap,
    committeeId,
    SLAStage.EXEMPT_NOTIFICATION,
    ReviewType.EXEMPT
  );
  const reviewConfig =
    reviewType === ReviewType.EXPEDITED || reviewType === ReviewType.FULL_BOARD
      ? getConfiguredSlaOrDefault(configMap, committeeId, SLAStage.REVIEW, reviewType)
      : null;
  const revisionConfig = getConfiguredSlaOrDefault(configMap, committeeId, SLAStage.REVISION_RESPONSE, null);

  return {
    submissionId: submission.id,
    committeeCode: submission.project?.committee?.code ?? null,
    reviewType,
    current: resolveCurrentSubmissionSla(submission, configMap, holidays, now),
    completeness: resolveCompletenessSummary(submission, completenessConfig, holidays, now),
    classification: resolveClassificationSummary(submission, classificationConfig, holidays, now),
    exemptNotification: resolveExemptNotificationSummary(submission, exemptNotificationConfig, holidays, now),
    review: resolveReviewSummary(submission, reviewConfig, holidays, now),
    revisionResponse: resolveRevisionSummary(submission, revisionConfig, holidays, now),
  };
};
