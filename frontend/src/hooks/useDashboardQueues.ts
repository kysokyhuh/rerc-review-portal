import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  AttentionMetrics,
  DecoratedQueueItem,
  LetterTemplateReadiness,
  QueueCounts,
} from "@/types";
import { fetchDashboardQueues } from "@/services/api";
import { buildLetterReadiness, decorateQueueItem } from "@/utils/slaUtils";
import {
  AUTO_REFRESH_INTERVAL_MS,
  CLASSIFICATION_WAIT_THRESHOLD,
  DUE_SOON_THRESHOLD,
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

    const now = new Date();
    const decoratedClassification = data.classificationQueue.map((item: any) =>
      decorateQueueItem(item, "classification", now)
    );
    const decoratedReview = data.reviewQueue.map((item: any) =>
      decorateQueueItem(item, "review", now)
    );
    const decoratedExempted = data.exemptedQueue.map((item: any) =>
      decorateQueueItem(item, "review", now)
    );
    const decoratedRevision = data.revisionQueue.map((item: any) =>
      decorateQueueItem(item, "revision", now)
    );

    const allItems = [
      ...decoratedClassification,
      ...decoratedReview,
      ...decoratedExempted,
      ...decoratedRevision,
    ];
    const overdue = allItems.filter((i) => i.slaStatus === "OVERDUE").length;
    const dueSoon = allItems.filter(
      (i) => i.workingDaysRemaining <= DUE_SOON_THRESHOLD && i.workingDaysRemaining >= 0
    ).length;
    const classificationWait = decoratedClassification.filter(
      (i) => i.workingDaysElapsed > CLASSIFICATION_WAIT_THRESHOLD
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
