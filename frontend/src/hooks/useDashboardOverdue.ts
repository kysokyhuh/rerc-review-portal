import { useCallback, useEffect, useState } from "react";
import type { OverdueReviewItem } from "@/types";
import { fetchDashboardOverdue } from "@/services/api";
import { AUTO_REFRESH_INTERVAL_MS } from "@/constants";

export function useDashboardOverdue(committeeCode: string) {
  const [overdueReviews, setOverdueReviews] = useState<OverdueReviewItem[]>([]);
  const [overdueEndorsements, setOverdueEndorsements] = useState<
    OverdueReviewItem[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverdue = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchDashboardOverdue(committeeCode);
      setOverdueReviews(data.overdueReviews ?? []);
      setOverdueEndorsements(data.overdueEndorsements ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load overdue data");
    } finally {
      setLoading(false);
    }
  }, [committeeCode]);

  useEffect(() => {
    loadOverdue();
    const interval = setInterval(loadOverdue, AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadOverdue]);

  return {
    overdueReviews,
    overdueEndorsements,
    loading,
    error,
    refresh: loadOverdue,
  };
}
