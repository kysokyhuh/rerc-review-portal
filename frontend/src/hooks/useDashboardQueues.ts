import { useCallback, useEffect, useMemo, useState } from "react";
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

export function useDashboardQueues(
  committeeCode: string,
  filters?: Record<string, string>
) {
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
      const data = await fetchDashboardQueues(committeeCode, filters);
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
        (item) =>
          item.workingDaysRemaining <= DUE_SOON_THRESHOLD &&
          item.workingDaysRemaining >= 0
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
  }, [committeeCode, filters ? JSON.stringify(filters) : ""]);

  useEffect(() => {
    loadQueues();
    const interval = setInterval(loadQueues, AUTO_REFRESH_INTERVAL_MS);
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
