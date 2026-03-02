import { useQuery } from "@tanstack/react-query";
import type { DashboardActivityEntry } from "@/types";
import { fetchDashboardActivity } from "@/services/api";
import { AUTO_REFRESH_INTERVAL_MS } from "@/constants";

export function useDashboardActivity(
  committeeCode: string,
  limit = 8,
  filters?: Record<string, string>
) {
  const filterKey = filters ? JSON.stringify(filters) : "";

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboardActivity", committeeCode, limit, filterKey],
    queryFn: () => fetchDashboardActivity(committeeCode, limit, filters),
    refetchInterval: AUTO_REFRESH_INTERVAL_MS,
    enabled: !!committeeCode,
  });

  return {
    activity: (data?.items ?? []) as DashboardActivityEntry[],
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : "Failed to load activity") : null,
    refresh: () => { refetch(); },
  };
}
