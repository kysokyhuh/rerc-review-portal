import { useState, useEffect } from "react";
import { fetchDashboardQueues, QueueCounts, QueueItem } from "@/services/api";

export function useDashboardQueues(committeeCode: string) {
  const [counts, setCounts] = useState<QueueCounts | null>(null);
  const [classificationQueue, setClassificationQueue] = useState<QueueItem[]>(
    []
  );
  const [reviewQueue, setReviewQueue] = useState<QueueItem[]>([]);
  const [revisionQueue, setRevisionQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadQueues = async () => {
      try {
        setLoading(true);
        const data = await fetchDashboardQueues(committeeCode);
        setCounts(data.counts);
        setClassificationQueue(data.classificationQueue);
        setReviewQueue(data.reviewQueue);
        setRevisionQueue(data.revisionQueue);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load queues");
      } finally {
        setLoading(false);
      }
    };

    loadQueues();
    const interval = setInterval(loadQueues, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [committeeCode]);

  return {
    counts,
    classificationQueue,
    reviewQueue,
    revisionQueue,
    loading,
    error,
  };
}
