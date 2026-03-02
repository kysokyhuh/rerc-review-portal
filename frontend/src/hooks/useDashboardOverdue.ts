import { useQuery } from "@tanstack/react-query";
import type { OverdueReviewItem } from "@/types";
import { fetchDashboardOverdue } from "@/services/api";
import { AUTO_REFRESH_INTERVAL_MS } from "@/constants";

export function useDashboardOverdue(
  committeeCode: string,
  filters?: Record<string, string>
) {
  const filterKey = filters ? JSON.stringify(filters) : "";

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboardOverdue", committeeCode, filterKey],
    queryFn: () => fetchDashboardOverdue(committeeCode, filters),
    refetchInterval: AUTO_REFRESH_INTERVAL_MS,
    enabled: !!committeeCode,
  });

  return {
    overdueReviews: (data?.overdueReviews ?? []) as OverdueReviewItem[],
    overdueEndorsements: (data?.overdueEndorsements ?? []) as OverdueReviewItem[],
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : "Failed to load overdue data") : null,
    refresh: () => { refetch(); },
  };
}
