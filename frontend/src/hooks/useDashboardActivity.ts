import { useCallback, useEffect, useState } from "react";
import type { DashboardActivityEntry } from "@/types";
import { fetchDashboardActivity } from "@/services/api";
import { AUTO_REFRESH_INTERVAL_MS } from "@/constants";

export function useDashboardActivity(
  committeeCode: string,
  limit = 8,
  filters?: Record<string, string>
) {
  const [activity, setActivity] = useState<DashboardActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadActivity = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchDashboardActivity(committeeCode, limit, filters);
      setActivity(data.items ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity");
    } finally {
      setLoading(false);
    }
  }, [committeeCode, limit, filters ? JSON.stringify(filters) : ""]);

  useEffect(() => {
    loadActivity();
    const interval = setInterval(loadActivity, AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadActivity]);

  return { activity, loading, error, refresh: loadActivity };
}
