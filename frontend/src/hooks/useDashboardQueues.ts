import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  AttentionMetrics,
  DecoratedQueueItem,
  LetterTemplateReadiness,
  QueueCounts,
} from "@/types";
import { fetchDashboardQueues } from "@/services/api";
import { buildLetterReadiness, deriveTemplateCode, findMissingFields } from "@/utils/slaUtils";
import {
  AUTO_REFRESH_INTERVAL_MS,
  CLASSIFICATION_WAIT_THRESHOLD,
} from "@/constants";

interface DashboardQueuesResult {
  counts: QueueCounts | null;
  classificationQueue: DecoratedQueueItem[];
  reviewQueue: DecoratedQueueItem[];
  exemptedQueue: DecoratedQueueItem[];
  revisionQueue: DecoratedQueueItem[];
  letterReadiness: LetterTemplateReadiness[];
  attention: AttentionMetrics;
  allItems: DecoratedQueueItem[];
  lastUpdated: Date | null;
  refresh: () => void;
  loading: boolean;
  error: string | null;
}

export function useDashboardQueues(
  committeeCode: string,
  filters?: Record<string, string>
): DashboardQueuesResult {
  const filterKey = filters ? JSON.stringify(filters) : "";

  const { data, isLoading, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["dashboardQueues", committeeCode, filterKey],
    queryFn: () => fetchDashboardQueues(committeeCode, filters),
    refetchInterval: AUTO_REFRESH_INTERVAL_MS,
    enabled: !!committeeCode,
  });

  const processed = useMemo(() => {
    if (!data) {
      return {
        counts: null,
        classificationQueue: [] as DecoratedQueueItem[],
        reviewQueue: [] as DecoratedQueueItem[],
        exemptedQueue: [] as DecoratedQueueItem[],
        revisionQueue: [] as DecoratedQueueItem[],
        letterReadiness: [] as LetterTemplateReadiness[],
        attention: { overdue: 0, dueSoon: 0, classificationWait: 0, missingLetterFields: 0 },
      };
    }

    const decorateFromBackend = (item: any, queue: DecoratedQueueItem["queue"]): DecoratedQueueItem => {
      const missingFields = findMissingFields(item);

      return {
        ...item,
        queue,
        slaStatus: item.slaStatus ?? "ON_TRACK",
        daysRemaining: item.daysRemaining ?? null,
        daysElapsed: item.daysElapsed ?? null,
        targetDays: item.targetDays ?? null,
        workingDaysRemaining: item.daysRemaining ?? null,
        workingDaysElapsed: item.daysElapsed ?? null,
        targetWorkingDays: item.targetDays ?? null,
        slaDueDate: item.slaDueDate ?? null,
        startedAt: item.startedAt ?? null,
        slaStage: item.slaStage ?? null,
        slaDayMode: item.slaDayMode ?? null,
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
    };

    const decoratedClassification = data.classificationQueue.map((item: any) =>
      decorateFromBackend(item, "classification")
    );
    const decoratedReview = data.reviewQueue.map((item: any) =>
      decorateFromBackend(item, "review")
    );
    const decoratedExempted = data.exemptedQueue.map((item: any) =>
      decorateFromBackend(item, "review")
    );
    const decoratedRevision = data.revisionQueue.map((item: any) =>
      decorateFromBackend(item, "revision")
    );

    const allItems = [
      ...decoratedClassification,
      ...decoratedReview,
      ...decoratedExempted,
      ...decoratedRevision,
    ];
    const overdue = allItems.filter((i) => i.slaStatus === "OVERDUE").length;
    const dueSoon = allItems.filter((i) => i.slaStatus === "DUE_SOON").length;
    const classificationWait = decoratedClassification.filter(
      (i) => (i.daysElapsed ?? 0) > CLASSIFICATION_WAIT_THRESHOLD
    ).length;
    const missingLetterFields = allItems.filter((i) => i.missingFields.length > 0).length;

    return {
      counts: { ...data.counts, dueSoon, overdue, classificationStuck: classificationWait, missingLetterFields },
      classificationQueue: decoratedClassification,
      reviewQueue: decoratedReview,
      exemptedQueue: decoratedExempted,
      revisionQueue: decoratedRevision,
      letterReadiness: buildLetterReadiness(allItems),
      attention: { overdue, dueSoon, classificationWait, missingLetterFields },
    };
  }, [data]);

  const allItems = useMemo(
    () => [
      ...processed.classificationQueue,
      ...processed.reviewQueue,
      ...processed.exemptedQueue,
      ...processed.revisionQueue,
    ],
    [
      processed.classificationQueue,
      processed.reviewQueue,
      processed.exemptedQueue,
      processed.revisionQueue,
    ]
  );

  return {
    ...processed,
    allItems,
    lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
    refresh: () => { refetch(); },
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : "Failed to load queues") : null,
  };
}
