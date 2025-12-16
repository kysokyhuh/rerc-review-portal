import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AttentionMetrics,
  DecoratedQueueItem,
  LetterTemplateReadiness,
  QueueCounts,
  QueueItem,
  QueueType,
  SLAStatus,
  fetchDashboardQueues,
} from "@/services/api";
import { addWorkingDays, workingDaysBetween } from "@/utils/dateUtils";

const SLA_TARGETS: Record<QueueType, number> = {
  classification: 5,
  review: 12,
  revision: 7,
};
const DUE_SOON_THRESHOLD = 3;
const CLASSIFICATION_WAIT_THRESHOLD = 3;

function deriveTemplateCode(submissionType?: string): string {
  if (!submissionType) return "6B";
  const normalized = submissionType.toUpperCase();
  if (normalized.includes("AMEND")) return "8B";
  if (normalized.includes("REVISION")) return "9B";
  if (normalized.includes("CONT") || normalized.includes("PROGRESS"))
    return "20B";
  return "6B";
}

function findMissingFields(item: QueueItem): string[] {
  const missing: string[] = [];
  if (!item.projectCode) missing.push("project_code");
  if (!item.projectTitle) missing.push("project_title");
  if (!item.piName) missing.push("pi_name");
  if (!item.piAffiliation) missing.push("pi_affiliation");
  if (!item.submissionType) missing.push("submission_type");
  return missing;
}

function decorateQueueItem(
  item: QueueItem,
  queue: QueueType,
  now: Date
): DecoratedQueueItem {
  const startDate = new Date(item.receivedDate);
  const targetWorkingDays = SLA_TARGETS[queue];
  const elapsedWorkingDays = workingDaysBetween(startDate, now);
  const workingDaysRemaining = targetWorkingDays - elapsedWorkingDays;
  const dueDate = addWorkingDays(startDate, targetWorkingDays);

  let slaStatus: SLAStatus = "ON_TRACK";
  if (workingDaysRemaining <= DUE_SOON_THRESHOLD) {
    slaStatus = "DUE_SOON";
  }
  if (workingDaysRemaining < 0) {
    slaStatus = "OVERDUE";
  }

  const missingFields = findMissingFields(item);

  return {
    ...item,
    queue,
    targetWorkingDays,
    workingDaysElapsed: elapsedWorkingDays,
    workingDaysRemaining,
    slaDueDate: dueDate.toISOString(),
    startedAt: startDate.toISOString(),
    slaStatus,
    missingFields,
    templateCode: deriveTemplateCode(item.submissionType),
    lastAction: item.status,
    nextAction:
      queue === "classification"
        ? "Classify"
        : queue === "review"
          ? "Assign reviewers"
          : "Follow up for revisions",
    notes:
      queue === "revision"
        ? "Remind PI of revision deadline"
        : "Ensure letter fields are complete",
  };
}

function buildLetterReadiness(
  items: DecoratedQueueItem[]
): LetterTemplateReadiness[] {
  const grouped = new Map<
    string,
    { ready: number; missingFields: number; samples: LetterTemplateReadiness["samples"] }
  >();

  items.forEach((item) => {
    const templateCode = item.templateCode;
    if (!grouped.has(templateCode)) {
      grouped.set(templateCode, { ready: 0, missingFields: 0, samples: [] });
    }
    const entry = grouped.get(templateCode)!;
    if (item.missingFields.length > 0) {
      entry.missingFields += 1;
      if (entry.samples.length < 3) {
        entry.samples.push({
          submissionId: item.id,
          projectCode: item.projectCode,
          projectTitle: item.projectTitle,
          fields: item.missingFields,
        });
      }
    } else {
      entry.ready += 1;
    }
  });

  return Array.from(grouped.entries()).map(([templateCode, value]) => ({
    templateCode,
    ready: value.ready,
    missingFields: value.missingFields,
    samples: value.samples,
  }));
}

export function useDashboardQueues(committeeCode: string) {
  const [counts, setCounts] = useState<QueueCounts | null>(null);
  const [classificationQueue, setClassificationQueue] = useState<
    DecoratedQueueItem[]
  >([]);
  const [reviewQueue, setReviewQueue] = useState<DecoratedQueueItem[]>([]);
  const [revisionQueue, setRevisionQueue] = useState<DecoratedQueueItem[]>([]);
  const [letterReadiness, setLetterReadiness] = useState<
    LetterTemplateReadiness[]
  >([]);
  const [attention, setAttention] = useState<AttentionMetrics>({
    overdue: 0,
    dueSoon: 0,
    classificationWait: 0,
    missingLetterFields: 0,
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQueues = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchDashboardQueues(committeeCode);
      const now = new Date();

      const decoratedClassification = data.classificationQueue.map((item) =>
        decorateQueueItem(item, "classification", now)
      );
      const decoratedReview = data.reviewQueue.map((item) =>
        decorateQueueItem(item, "review", now)
      );
      const decoratedRevision = data.revisionQueue.map((item) =>
        decorateQueueItem(item, "revision", now)
      );

      const allItems = [
        ...decoratedClassification,
        ...decoratedReview,
        ...decoratedRevision,
      ];

      const overdue = allItems.filter(
        (item) => item.slaStatus === "OVERDUE"
      ).length;
      const dueSoon = allItems.filter(
        (item) => item.slaStatus === "DUE_SOON"
      ).length;
      const classificationWait = decoratedClassification.filter(
        (item) => item.workingDaysElapsed > CLASSIFICATION_WAIT_THRESHOLD
      ).length;
      const missingLetterFields = allItems.filter(
        (item) => item.missingFields.length > 0
      ).length;

      setCounts({
        ...data.counts,
        dueSoon,
        overdue,
        classificationStuck: classificationWait,
        missingLetterFields,
      });
      setClassificationQueue(decoratedClassification);
      setReviewQueue(decoratedReview);
      setRevisionQueue(decoratedRevision);
      setLetterReadiness(buildLetterReadiness(allItems));
      setAttention({
        overdue,
        dueSoon,
        classificationWait,
        missingLetterFields,
      });
      setLastUpdated(now);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load queues");
    } finally {
      setLoading(false);
    }
  }, [committeeCode]);

  useEffect(() => {
    loadQueues();
    const interval = setInterval(loadQueues, 90000); // Refresh every 90s per UX objective
    return () => clearInterval(interval);
  }, [loadQueues]);

  const allItems = useMemo(
    () => [...classificationQueue, ...reviewQueue, ...revisionQueue],
    [classificationQueue, reviewQueue, revisionQueue]
  );

  return {
    counts,
    classificationQueue,
    reviewQueue,
    revisionQueue,
    letterReadiness,
    attention,
    allItems,
    lastUpdated,
    refresh: loadQueues,
    loading,
    error,
  };
}
